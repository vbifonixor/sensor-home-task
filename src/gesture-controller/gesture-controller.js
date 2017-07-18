ym.modules.define('shri2017.imageViewer.GestureController', [
    'shri2017.imageViewer.EventManager',
    'util.extend'
], function (provide, EventManager, extend) {

    var DBL_TAP_STEP = 0.2;
    var WHEEL_STEP = 0.02;

    var Controller = function (view) {
        this._view = view;
        this._eventManager = new EventManager(
            this._view.getElement(),
            this._eventHandler.bind(this)
        );
        this._lastEventTypes = '';
        this._oneTouchEventTypes = '';
        this._lastStartEvent = {};
    };

    extend(Controller.prototype, {
        destroy: function () {
            this._eventManager.destroy();
        },

        _eventHandler: function (event) {
            var state = this._view.getState();

            // dblclick
            if (!this._lastEventTypes) {
                setTimeout(function () {
                    this._lastEventTypes = '';
                }.bind(this), 1000);
            }
            this._lastEventTypes += ' ' + event.type;


            if ((/(start) ((move) ){0,2}(end )(start) ((move ){0,2}(end))/g).test(this._lastEventTypes)) {
                this._lastEventTypes = '';
                this._processDbltap(this._lastStartEvent);
                return;
            }

            // One Touch Zoom

            // Добавляем в строку жеста информацию о его начале из this._lastEventTypes
            if (event.type === 'start') {
              this._lastStartEvent = event;
            }

            if ((/(start) ((move) ){0,2}(end )(start) ((move) ?)+/g).test(this._lastEventTypes) && event.device === 'touch') {
              if(!this._oneTouchEventTypes) {
                this._oneTouchEventTypes = this._lastEventTypes;
              }
            }
            // Добавляем информацию о текущем событии (если таковое происходит)

            if(this._oneTouchEventTypes !== ''){
              this._oneTouchEventTypes += ' ' + event.type;
            }

            if((/(start) ((move) ){0,2}(end )(start) ((move )+)/g).test(this._oneTouchEventTypes) &&
                event.type !== 'end')  {
              // Вызываем OneTouchZoom
              this._processOneTouchZoom(this._lastStartEvent, event);
            }

            if ((/(start) ((move) ){0,2}(end )(start) ((move )+(end))/g).test(this._oneTouchEventTypes) && event.type === 'end'){
              this._oneTouchEventTypes = '';
              return;
            }





            if (event.type.indexOf('zoom') != -1) {
              this._processWheel(event);
            }

            if (event.type === 'move' && this._oneTouchEventTypes === '') {
                if (event.distance > 1 && event.distance !== this._initEvent.distance) {
                    this._processMultitouch(event);
                } else {
                    this._processDrag(event);
                }
            } else {
                this._initState = this._view.getState();
                this._initEvent = event;
            }

        },

        _processDrag: function (event) {
            this._view.setState({
                positionX: this._initState.positionX + (event.targetPoint.x - this._initEvent.targetPoint.x),
                positionY: this._initState.positionY + (event.targetPoint.y - this._initEvent.targetPoint.y)
            });
        },

        _processMultitouch: function (event) {
            this._scale(
                event.targetPoint,
                this._initState.scale * (event.distance / this._initEvent.distance)
            );
        },

        _processDbltap: function (event) {
            var state = this._view.getState();
            this._scale(
                event.targetPoint,
                state.scale + DBL_TAP_STEP
            );
        },

        _processOneTouchZoom: function (startEvent, moveEvent) {
          var state = this._view.getState();

          var targetPoint = {
              x: startEvent.targetPoint.x,
              y: startEvent.targetPoint.y
          };

          distance = moveEvent.targetPoint.y - startEvent.targetPoint.y;

          this._scale(
            targetPoint,
            state.scale + (distance / 50000)
          );
        },

        _processWheel: function (event) {
          var state = this._view.getState();

          var currentStep = 0;

          if (event.type === 'zoomout') {
            currentStep -= WHEEL_STEP;
          }
          else if (event.type === 'zoomin') {
            currentStep += WHEEL_STEP;
          }

          this._scale(
            event.targetPoint,
            state.scale + currentStep
          )
        },

        _scale: function (targetPoint, newScale) {
            newScale = Math.max(Math.min(newScale, 10), 0.02);
            var imageSize = this._view.getImageSize();
            var state = this._view.getState();
            // Позиция прикосновения на изображении на текущем уровне масштаба
            var originX = targetPoint.x - state.positionX;
            var originY = targetPoint.y - state.positionY;
            // Размер изображения на текущем уровне масштаба
            var currentImageWidth = imageSize.width * state.scale;
            var currentImageHeight = imageSize.height * state.scale;
            // Относительное положение прикосновения на изображении
            var mx = originX / currentImageWidth;
            var my = originY / currentImageHeight;
            // Размер изображения с учетом нового уровня масштаба
            var newImageWidth = imageSize.width * newScale;
            var newImageHeight = imageSize.height * newScale;
            // Рассчитываем новую позицию с учетом уровня масштаба
            // и относительного положения прикосновения
            state.positionX += originX - (newImageWidth * mx);
            state.positionY += originY - (newImageHeight * my);
            // Устанавливаем текущее положение мышки как "стержневое"
            state.pivotPointX = targetPoint.x;
            state.pivotPointY = targetPoint.y;
            // Устанавливаем масштаб и угол наклона
            state.scale = newScale;
            this._view.setState(state);
        }
    });

    provide(Controller);
});
