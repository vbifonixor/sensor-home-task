ym.modules.define('shri2017.imageViewer.View', [
    'shri2017.imageViewer.util.imageLoader',
    'util.extend',
    'view.css'
], function (provide, imageLoader, extend) {
    var View = function (params) {
        this._resetData();
        this._setupDOM(params);
        this.setURL(params.url);
    };

    extend(View.prototype, {
        setURL: function (url) {
            this._curURL = url;
            if (this._holderElem) {
                imageLoader(url).then(this._onImageLoaded, this);
            }
        },

        getElement: function () {
            return this._holderElem.parentElement;
        },

        getImageSize: function () {
            return {
                width: this._properties.image.width,
                height: this._properties.image.height
            };
        },

        getState: function () {
            // !
            return extend({}, this._state);
        },

        setState: function (state) {
            // !
            this._state = extend({}, this._state, state);
            this._setTransform(this._state);
        },

        destroy: function () {
            this._teardownDOM();
            this._resetData();
        },

        _onImageLoaded: function (data) {
            if (this._curURL === data.url) {
                var image = data.image;
                this._properties.image = image;
                // Рассчитываем такой масштаб,
                // чтобы сразу все изображение отобразилось
                var containerSize = this._properties.size;
                var zoom = (image.width > image.height) ?
                    containerSize.width / image.width :
                    containerSize.height / image.height;
                this.setState({
                    positionX: - (image.width * zoom - containerSize.width) / 2,
                    positionY: - (image.height * zoom - containerSize.height) / 2,
                    scale: zoom
                });
            }
        },

        _setTransform: function (state) {
            var ctx = this._holderElem.getContext('2d');
            // Сбрасываем текущую трансформацию холста.
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this._properties.size.width, this._properties.size.height);
            // Устаналиваем новую
            ctx.translate(state.pivotPointX, state.pivotPointY);
            ctx.scale(state.scale, state.scale);
            // Отрисовываем изображение с учетом текущей "стержневой" точки
            ctx.drawImage(
                this._properties.image,
                (state.positionX - state.pivotPointX) / state.scale,
                (state.positionY - state.pivotPointY) / state.scale
            );
        },

        _setupDOM: function (params) {
            this._properties.size.width = params.size.width;
            this._properties.size.height = params.size.height;

            var containerElem = document.createElement('image-viewer');
            containerElem.className = 'image-viewer__view';
            containerElem.style.width = params.size.width + 'px';
            containerElem.style.height = params.size.height + 'px';

            this._holderElem = document.createElement('canvas');
            this._holderElem.setAttribute('width', params.size.width);
            this._holderElem.setAttribute('height', params.size.height);

            containerElem.appendChild(this._holderElem);
            params.elem.appendChild(containerElem);
        },

        _teardownDOM: function () {
            var containerElem = this._holderElem.parentElement;
            containerElem.parentElement.removeChild(containerElem);
            this._holderElem = null;
            this._curURL = null;
        },

        _resetData: function () {
            this._properties = {
                size: {
                    width: 0,
                    height: 0
                },
                image: {
                    width: 0,
                    height: 0
                }
            };

            this._state = {
                positionX: 0,
                positionY: 0,
                scale: 1,
                pivotPointX: 0,
                pivotPointY: 0
            };
        }
    });

    provide(View);
});
