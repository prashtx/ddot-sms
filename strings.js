/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

// TODO: read the strings in from a JSON or YAML file
module.exports = {
  GenericFailMessage: 'Sorry! I couldn\'t process that. Please send an address or intersection near you. For example:\nwoodward and warren',
  Greeting: 'Hi! To find active bus routes, please send an address or intersection near you. For example:\nwoodward and warren',
  ShortCodeHelp: 'DDOT: Text intersection to find active bus times Info: 888.849.6231 or detroit@codeforamerica.org Msg&data rates may apply Reply STOP to cancel 2 msg/request',
  ShortCodeStop: 'You\'re unsubscribed from DDOT SMS Service, no more messages will be sent. Text HELP for help or detroit@codeforamerica.org. Msg&data rates may apply',
  NoArrivals: 'Sorry, I don\'t see buses in the next %s minutes for %s.\nCall (888) DDOT-BUS for information.', // lookahead time, stop name
  Arrivals: '%s:\n%s',
  ClosestStop: 'Closest stop: %s.',
  CloseRoutes: 'Please send the letter of the bus you\'d like:',
  NoCloseRoutes: 'Sorry, I don\'t see any active routes nearby.',
  OtherCloseStops: 'Send letter for:',
  OtherCloseRoutes: 'Send letter for:',
  SingleStop: '@ %s\n%s', // Stop name, arrivals
  SingleStopWithSched: '@ %s, %s *scheduled', // Stop name, arrivals
  MiscWithSched: '%s *scheduled',
  TimeMinutes: '%s min',
  TimeMinutesSchedule: '%s* min',
  Option: '%s) %s', // Letter, meaning
  NumberSwitch: 'Hi! We\'re switching to a new, better number. Please send your location or bus stop ID to 50464 from now on. Go ahead, give it a try!'
};
