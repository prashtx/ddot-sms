/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

// TODO: read the strings in from a JSON or YAML file
module.exports = {
  GenericFailMessage: 'Sorry, I couldn\'t process your request! Trying something like: woodward and mack',
  NoArrivals: 'Sorry, I don\'t see anything for that stop',
  ClosestStop: 'Closest stop: %s.',
  OtherCloseStops: 'Send letter for:',
  OtherCloseRoutes: 'Send letter for:',
  SingleStop: '@ %s\n%s', // Stop name, arrivals
  SingleStopWithSched: '@ %s, %s *scheduled', // Stop name, arrivals
  MiscWithSched: '%s *scheduled',
  Option: '%s)%s' // Letter, meaning
};
