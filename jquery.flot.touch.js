
/* global jQuery */

(function($) {
    'use strict';

    var options = {
        pan: {
            enableTouch: false
        }
    };

    function init(plot) {
        plot.hooks.processOptions.push(initTouchNavigation);
    }

    function initTouchNavigation(plot, options) {
        var gestureState = {
                twoTouches: false,
                currentTapStart: { x: 0, y: 0 },
                currentTapEnd: { x: 0, y: 0 },
                prevTap: { x: 0, y: 0 },
                currentTap: { x: 0, y: 0 },
                interceptedLongTap: false,
                prevTapTime: null,
                tapStartTime: null
            },
            mainEventHolder;

        function interpretGestures(e) {
            if (isPinchEvent(e)) {
                executeAction(e, 'pinch');
            } else {
                executeAction(e, 'pan');
                if (!wasPinchEvent(e)) {
                    if (isDoubleTap(e)) {
                        executeAction(e, 'doubleTap');
                    }
                    if (isLongTap(e)) {
                        executeAction(e, 'longTap');
                    }
                }
            }
        }

        function executeAction(e, gesture) {
            switch (gesture) {
                case 'pan':
                    pan[e.type](e);
                    break;
                case 'pinch':
                    pinch[e.type](e);
                    break;
                case 'doubleTap':
                    doubleTap.onDoubleTap(e);
                    break;
                case 'longTap':
                    longTap.onLongTap(e);
                    break;
                default:
                    break;
            }
        }

        function bindEvents(plot, eventHolder) {
            mainEventHolder = eventHolder[0];
            eventHolder[0].addEventListener('touchstart', interpretGestures, false);
            eventHolder[0].addEventListener('touchmove', interpretGestures, false);
            eventHolder[0].addEventListener('touchend', interpretGestures, false);
        }

        function shutdown(plot, eventHolder) {
            eventHolder[0].removeEventListener('touchstart', interpretGestures);
            eventHolder[0].removeEventListener('touchmove', interpretGestures);
            eventHolder[0].removeEventListener('touchend', interpretGestures);
        }

        var pan = {
            touchstart: function(e) {
                preventEventPropagation(e);

                updatePrevForDoubleTap();
                updateCurrentForDoubleTap(e);
                updateStateForLongTapStart(e);

                mainEventHolder.dispatchEvent(new CustomEvent('panstart', { detail: e }));
            },

            touchmove: function(e) {
                updateCurrentForDoubleTap(e);
                updateStateForLongTapEnd(e);

                mainEventHolder.dispatchEvent(new CustomEvent('pandrag', { detail: e }));
            },

            touchend: function(e) {
                preventEventPropagation(e);
                if (wasPinchEvent(e)) {
                    mainEventHolder.dispatchEvent(new CustomEvent('pinchend', { detail: e }));
                    mainEventHolder.dispatchEvent(new CustomEvent('panstart', { detail: e }));
                } else if (noTouchActive(e)) {
                    mainEventHolder.dispatchEvent(new CustomEvent('panend', { detail: e }));
                }
            }
        };

        var pinch = {
            touchstart: function(e) {
                preventEventPropagation(e);
                mainEventHolder.dispatchEvent(new CustomEvent('pinchstart', { detail: e }));
            },

            touchmove: function(e) {
                preventEventPropagation(e);
                gestureState.twoTouches = isPinchEvent(e);
                mainEventHolder.dispatchEvent(new CustomEvent('pinchdrag', { detail: e }));
            },

            touchend: function(e) {
                preventEventPropagation(e);
            }
        };

        var doubleTap = {
            onDoubleTap: function(e) {
                preventEventPropagation(e);
                mainEventHolder.dispatchEvent(new CustomEvent('doubletap', { detail: e }));
            }
        };

        var longTap = {
            onLongTap: function(e) {
                preventEventPropagation(e);
                mainEventHolder.dispatchEvent(new CustomEvent('longtap', { detail: e }));
            }
        };

        if (options.pan.enableTouch === true) {
            plot.hooks.bindEvents.push(bindEvents);
            plot.hooks.shutdown.push(shutdown);
        };

        function updatePrevForDoubleTap() {
            gestureState.prevTap = {
                x: gestureState.currentTap.x,
                y: gestureState.currentTap.y
            };
        };

        function updateCurrentForDoubleTap(e) {
            gestureState.currentTap = {
                x: e.touches[0].pageX,
                y: e.touches[0].pageY
            };
        }

        function updateStateForLongTapStart(e) {
            gestureState.tapStartTime = new Date().getTime();
            gestureState.interceptedLongTap = false;
            gestureState.currentTapStart = {
                x: e.touches[0].pageX,
                y: e.touches[0].pageY
            };
        };

        function updateStateForLongTapEnd(e) {
            gestureState.currentTapEnd = {
                x: e.touches[0].pageX,
                y: e.touches[0].pageY
            };
        };

        function isLongTap(e) {
            var currentTime = new Date().getTime(),
                tapDuration = currentTime - gestureState.tapStartTime,
                maxDistanceFromTapStart = 20,
                minTapDuration = 1000;
            if (tapDuration > minTapDuration && !gestureState.interceptedLongTap) {
                if (distance(gestureState.currentTapStart.x, gestureState.currentTapStart.y, gestureState.currentTapEnd.x, gestureState.currentTapEnd.y) < maxDistanceFromTapStart) {
                    gestureState.interceptedLongTap = true;
                    return true;
                }
            }
            return false;
        }

        function isDoubleTap(e) {
            var currentTime = new Date().getTime(),
                intervalBetweenTaps = currentTime - gestureState.prevTapTime,
                maxDistanceBetweenTaps = 20,
                maxIntervalBetweenTaps = 500;

            if (intervalBetweenTaps >= 0 && intervalBetweenTaps < maxIntervalBetweenTaps) {
                if (distance(gestureState.prevTap.x, gestureState.prevTap.y, gestureState.currentTap.x, gestureState.currentTap.y) < maxDistanceBetweenTaps) {
                    e.firstTouch = gestureState.prevTap;
                    e.secondTouch = gestureState.currentTap;
                    return true;
                }
            }
            gestureState.prevTapTime = currentTime;
            return false;
        }

        function preventEventPropagation(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function distance(x1, y1, x2, y2) {
            return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
        }

        function noTouchActive(e) {
            return (e.touches && e.touches.length === 0);
        }

        function wasPinchEvent(e) {
            return (gestureState.twoTouches && e.touches.length === 1);
        }

        function isPinchEvent(e) {
            return e.touches && e.touches.length === 2;
        }
    }

    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'navigateTouch',
        version: '0.3'
    });
})(jQuery);