ym.modules.define('shri2017.imageViewer.EventManager', [
    'util.extend',
    'shri2017.imageViewer.PointerCollection'
], function (provide, extend, PointerCollection) {

    var EVENTS = {
        mousedown: 'start',
        mousemove: 'move',
        mouseup: 'end',
        touchstart: 'start',
        touchmove: 'move',
        touchend: 'end',
        touchcancel: 'end',
        pointerdown: 'start',
        pointermove: 'move',
        pointerup: 'end',
        wheelup: 'zoomin',
        wheeldown: 'zoomout'
    };

    var pointers = new PointerCollection();

    function EventManager(elem, callback) {
        this._elem = elem;
        this._callback = callback;
        this._setupListeners();
    }

    extend(EventManager.prototype, {
        destroy: function () {
            this._teardownListeners();
        },

        _setupListeners: function () {

          this._wheelListener = this._wheelEventHandler.bind(this);
          this._addEventListeners('wheel', this._elem, this._wheelListener);

          if(window.PointerEvent) {
            this._pointerListener = this._pointerEventHandler.bind(this);
            this._addEventListeners('pointerdown', this._elem, this._pointerListener);
          }
          else {
            this._mouseListener = this._mouseEventHandler.bind(this);
            this._touchListener = this._touchEventHandler.bind(this);
            this._addEventListeners('mousedown', this._elem, this._mouseListener);
            this._addEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
          }
        },

        _teardownListeners: function () {
            this._removeEventListeners('mousedown', this._elem, this._mouseListener);
            this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            this._removeEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
        },

        _addEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.addEventListener(type, callback);
            }, this);
        },

        _removeEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.removeEventListener(type, callback);
            }, this);
        },

        _mouseEventHandler: function (event) {
            event.preventDefault();

            if (event.type === 'mousedown') {
                this._addEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            } else if (event.type === 'mouseup') {
                this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            }

            var elemOffset = this._calculateElementOffset(this._elem);

            this._callback({
                type: EVENTS[event.type],
                targetPoint: {
                    x: event.clientX - elemOffset.x,
                    y: event.clientY - elemOffset.y
                },
                distance: 1,
                device: 'mouse'
            });
        },

        _touchEventHandler: function (event) {
            event.preventDefault();

            var touches = event.touches;
            // touchend/touchcancel
            if (touches.length === 0) {
                touches = event.changedTouches;
            }

            var targetPoint;
            var distance = 1;
            var elemOffset = this._calculateElementOffset(this._elem);

            if (touches.length === 1) {
                targetPoint = {
                    x: touches[0].clientX,
                    y: touches[0].clientY
                };
            } else {
                var firstTouch = touches[0];
                var secondTouch = touches[1];
                targetPoint = this._calculateTargetPoint(firstTouch, secondTouch);
                distance = this._calculateDistance(firstTouch, secondTouch);
            }

            targetPoint.x -= elemOffset.x;
            targetPoint.y -= elemOffset.y;

            this._callback({
                type: EVENTS[event.type],
                targetPoint: targetPoint,
                distance: distance,
                device: 'touch'
            });
        },

        _pointerEventHandler: function(event) {
          event.preventDefault();

          if (event.type === 'pointerdown') {
              this._addEventListeners('pointermove pointerup pointercancel', this._elem, this._pointerListener);
              event.target.setPointerCapture(event.pointerId);
              if (!pointers.exists(event)) {
                pointers.add(event);
              }
          } else if (event.type === 'pointerup') {
            if (pointers.exists(event)) {
              pointers.remove(event);
              pointers.clear();
            }
              this._removeEventListeners('pointermove pointerup', this._elem, this._pointerListener);
              event.target.releasePointerCapture(event.pointerId);
          } else if (event.type === 'pointermove') {
            if (pointers.exists(event)) {
    					pointers.update(event);
    				}
          } else if (pointers.isMultiTouch() && (event.type === 'pointerdown' || event.type === 'pointermove')) {
            pointers.each(function (pointer) {
              pointers.remove(pointer);
            });
          }

          var targetPoint;
          var distance = 1;
          var elemOffset = this._calculateElementOffset(this._elem);

          var pointersArr = pointers.getArray();

          if (pointersArr.length === 1) {
            targetPoint = {
              x: pointersArr[0].clientX,
              y: pointersArr[0].clientY
            }
          }
          else {
            var firstTouch = pointersArr[0];
            var secondTouch = pointersArr[1];
            if (pointersArr.length){
              targetPoint = this._calculateTargetPoint(firstTouch, secondTouch);
              distance = this._calculateDistance(firstTouch, secondTouch);
            }
            else {
              targetPoint = {
                x: 0,
                y: 0
              };
            }
          };

          targetPoint.x -= elemOffset.x;
          targetPoint.y -= elemOffset.y;

          this._callback({
              type: EVENTS[event.type],
              targetPoint: targetPoint,
              distance: distance,
              device: event.pointerType
          });
        },

        _wheelEventHandler: function(event) {
          var elemOffset = this._calculateElementOffset(this._elem);

          this._callback({
            type: EVENTS[event.deltaY > 0 ? 'wheeldown' : 'wheelup'],
            targetPoint: {
              x: event.clientX - elemOffset.x,
              y: event.clientY - elemOffset.y
            },
            distance: 0
          })
        },

        _calculateTargetPoint: function (firstTouch, secondTouch) {
            return {
                x: (secondTouch.clientX + firstTouch.clientX) / 2,
                y: (secondTouch.clientY + firstTouch.clientY) / 2
            };
        },

        _calculateDistance: function (firstTouch, secondTouch) {
            return Math.sqrt(
                Math.pow(secondTouch.clientX - firstTouch.clientX, 2) +
                Math.pow(secondTouch.clientY - firstTouch.clientY, 2)
            );
        },

        _calculateElementOffset: function (elem) {
            var bounds = elem.getBoundingClientRect();
            return {
                x: bounds.left,
                y: bounds.top
            };
        }
    });

    provide(EventManager);
});
