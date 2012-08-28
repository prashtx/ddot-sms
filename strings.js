/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

// TODO: read the strings in from a JSON or YAML file
module.exports = {
  GenericFailMessage: 'Sorry! I couldn\'t process that. Try something like:\nwoodward and mack',
  NoArrivals: 'Sorry, I don\'t see buses in the next %s minutes for %s.\nCall (888) DDOT-BUS for information.', // lookahead time, stop name
  Arrivals: '%s:\n%s min',
  ClosestStop: 'Closest stop: %s.',
  CloseRoutes: 'Please send the letter of the bus you\'d like:',
  NoCloseRoutes: 'Sorry, I don\'t see any active routes nearby.',
  OtherCloseStops: 'Send letter for:',
  OtherCloseRoutes: 'Send letter for:',
  SingleStop: '@ %s\n%s', // Stop name, arrivals
  SingleStopWithSched: '@ %s, %s *scheduled', // Stop name, arrivals
  MiscWithSched: '%s *scheduled',
  Option: '%s) %s' // Letter, meaning
};
