import 'package:shared_preferences/shared_preferences.dart';

abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

/// Persists the device token in shared_preferences (localStorage on web).
class SharedPrefsTokenStore implements TokenStore {
  static const key = 'device_token';

  @override
  Future<String?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(key);
    return (token == null || token.isEmpty) ? null : token;
  }

  @override
  Future<void> write(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, token);
  }

  @override
  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
  }
}

class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this.token]);

  String? token;

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String token) async => this.token = token;

  @override
  Future<void> clear() async => token = null;
}
