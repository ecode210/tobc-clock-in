import 'package:intl/intl.dart';

final _clockFormat = DateFormat("EEEE, MMM d 'at' hh:mm a", 'en_US');
final _dayFormat = DateFormat('EEEE, MMM d', 'en_US');

/// Formats a clock-in time like "Sunday, Oct 18 at 07:14 AM".
String formatClockTime(DateTime time) => _clockFormat.format(time);

/// Formats a calendar day like "Sunday, Oct 18".
String formatDay(DateTime day) => _dayFormat.format(day);
