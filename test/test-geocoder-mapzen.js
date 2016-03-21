var should = require('should');
var mapzen = require('../geocoder-mapzen');

describe('mapzen', function(){
  it('should code an address', function(done){
    mapzen.code("8706 lyndon", "Detroit, MI")
     .then(function(coords){
      coords.should.have.property('lat');
      coords.should.have.property('lon');
      coords.should.have.property('meta');

      (coords.meta.quality).should.be.aboveOrEqual(0.87);
      done();
     }, function(reason){
      should.not.exist(reason);
      done();
     })
     .catch(done);
  });

  it('fail on no results', function(done){
    mapzen.code("123 noidea", "Detroit, MI")
     .then(function(coords){
      should.not.exist(coords);
      done();
     }, function(reason){
      should.exist(reason);
      done();
     })
     .catch(done);
  });

  it('fail on a bad address', function(done){
    mapzen.code("123 noidea", "Detroit, MI")
     .then(function(coords){
      should.not.exist(coords);
      done();
     }, function(reason){
      should.exist(reason);
      done();
     })
     .catch(done);
  });
});
