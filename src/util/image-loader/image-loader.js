ym.modules.define('shri2017.imageViewer.util.imageLoader', [
    'vow'
], function (provide, vow) {
    var imgLoader = function (url) {
        return new vow.Promise(
            function (resolve, reject) {
                var img = new Image();
                img.onload = function () {
                    resolve({
                        url: url,
                        image: img
                    });
                };
                img.onerror = img.onabort = reject;
                img.src = url;
            }
        );
    };
    provide(imgLoader);
});
