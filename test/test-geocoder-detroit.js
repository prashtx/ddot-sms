var assert = require("assert");
var should = require("should");
var detroit = require("../geocoder-detroit");

describe("detroit", function() {
  it("should code an intersection", function(done) {
    detroit.code("Sunderland & McNichols", "Detroit, MI").then(
      function(coords) {
        coords.should.have.property("lat");
        coords.should.have.property("lon");
        coords.should.have.property("meta");
        done();
      },
      function(reason) {
        should.not.exist(reason);
        done();
      }
    );
  });
});
