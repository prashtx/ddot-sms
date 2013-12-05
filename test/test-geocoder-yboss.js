var assert = require("assert");
var should = require('should');
var yahoo = require('../geocoder-yboss');

describe('yboss', function(){
  it('should code an intersection', function(done){
	yahoo.code("Woodward at Warren", "Detroit, MI")
		 .then(function(coords){
		 	coords.should.have.property('lat');
		 	coords.should.have.property('lon');
		 	coords.should.have.property('meta');
		 	done();
		 }, function(reason){
		 	should.not.exist(reason);
		 	done();
		 });
  });
})
