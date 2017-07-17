ym.modules.define('shri2017.imageViewer.PointerCollection', [], function(provide) {

  var PointerCollection = function () {
    this._pointers = {};
  };

  PointerCollection.prototype.add = function (event) {
    this._pointers[event.pointerId] = event;
  };

  PointerCollection.prototype.update = function (event) {
    this.add(event);
  };

  PointerCollection.prototype.get = function (event) {
    return this._pointers[event.pointerId];
  };

  PointerCollection.prototype.remove = function (event) {
    delete this._pointers[event.pointerId];
  };

  PointerCollection.prototype.clear = function() {
    this._pointers = {};
  }

  PointerCollection.prototype.exists = function (event) {
    return this._pointers.hasOwnProperty(event.pointerId);
  };

  PointerCollection.prototype.each = function (callback, thisArg) {
    if (this._pointers) {
      for (var key in this._pointers) {
        callback.call(thisArg, this._pointers[key]);
      }
    }
  };

  PointerCollection.prototype.getArray = function () {
    var array = [];
    this.each(function(pointer) {
      array.push(pointer);
    });
    return array;
  }

  PointerCollection.prototype.isMultiTouch = function() {
    var quantity = 0;
    console.log(this._pointers);
    this.each(function(pointer) {
      quantity++;
    });
    return quantity >= 2;
  };

  provide(PointerCollection);

});
