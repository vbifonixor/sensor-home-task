ym.modules.define('shri2017.ImageViewer', [
    'shri2017.imageViewer.View',
    'shri2017.imageViewer.GestureController',
    'util.extend'
], function (provide, View, GestureController, extend) {

    function ImageViewer(params) {
        params = this._validateParams(params);
        this._view = new View(params);
        this._controller = new GestureController(this._view);
    }

    extend(ImageViewer.prototype, {
        destroy: function () {
            this._controller.destroy();
            this._view.destroy();
            return this;
        },

        _validateParams: function (params) {
            if (!params.url) {
                throw new Error('URL parameter is required');
            }

            if (!params.elem) {
                throw new Error('Elem parameter is required');
            }

            return extend({
                size: {
                    width: 800,
                    height: 600
                }
            }, params);
        }
    });

    provide(ImageViewer);
});
