/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

// TODO: read the strings in from a JSON or YAML file
module.exports = {
  GenericFailMessage: 'Sorry, I couldn\'t process your request! Trying something like: woodward and mack',
  NoArrivals: 'Sorry, I don\'t see anything for that stop',
  ClosestStop: 'Closest stop: %s.',
  OtherCloseStops: 'Send letter for:',
  SingleStop: '@ %s, %s', // Stop name, arrivals
  SingleStopWithSched: '@ %s, %s *=sched', // Stop name, arrivals
  MiscWithSched: '%s *=sched',
  Option: '%s)%s' // Letter, meaning
};
