/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

// TODO: read the strings in from a JSON or YAML file
module.exports = {
  GenericFailMessage: 'Sorry, we couldn\'t process your request! Trying something like: woodward and mack',
  NoArrivals: 'Sorry, no known vehicles arriving at that stop',
  ClosestStop: 'Closest stop: %s.',
  OtherCloseStops: 'Send letter for stops:',
  SingleStop: '@ %s, %s', // Stop name, arrivals
  SingleStopWithSched: '@ %s, %s *=sched' // Stop name, arrivals
};
