import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Talks to the Phase 1 backend (see ../../../backend). Base URL points at
/// an Android emulator's host-loopback address by default — override via
/// `--dart-define=API_BASE_URL=...` for a device or staging server.
class ApiClient {
  static const _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  static String get baseUrl => _baseUrl;

  Future<String?> currentToken() => _token();

  Future<String?> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', token);
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
  }

  Future<Map<String, dynamic>> requestOtp(String phoneNumber) async {
    return _post('/auth/request-otp', {'phoneNumber': phoneNumber}, auth: false);
  }

  Future<String> verifyOtp(String phoneNumber, String otp, {String? name}) async {
    final body = await _post('/auth/verify-otp', {
      'phoneNumber': phoneNumber,
      'otp': otp,
      if (name != null) 'name': name,
      'role': 'rider',
    }, auth: false);
    final token = body['accessToken'] as String;
    await saveToken(token);
    return token;
  }

  Future<Map<String, dynamic>> requestTrip({
    required double pickupLat,
    required double pickupLng,
    String? pickupLandmark,
    required double dropoffLat,
    required double dropoffLng,
    String? dropoffLandmark,
    String? requestedVehicleType,
    String? paymentMethod,
  }) {
    return _post('/trips', {
      'pickupLat': pickupLat,
      'pickupLng': pickupLng,
      if (pickupLandmark != null) 'pickupLandmark': pickupLandmark,
      'dropoffLat': dropoffLat,
      'dropoffLng': dropoffLng,
      if (dropoffLandmark != null) 'dropoffLandmark': dropoffLandmark,
      if (requestedVehicleType != null) 'requestedVehicleType': requestedVehicleType,
      if (paymentMethod != null) 'paymentMethod': paymentMethod,
    });
  }

  Future<Map<String, dynamic>> getTrip(String tripId) {
    return _get('/trips/$tripId');
  }

  /// Returns the payment for a trip, or `null` if it's not been created yet
  /// (e.g. a cash trip that isn't complete, or a momo request not yet sent).
  Future<Map<String, dynamic>?> getTripPayment(String tripId) async {
    final result = await _getNullable('/trips/$tripId/payment');
    return result as Map<String, dynamic>?;
  }

  Future<List<dynamic>> myTrips() async {
    final result = await _getList('/trips/mine');
    return result;
  }

  Future<void> cancelTrip(String tripId) {
    return _patch('/trips/$tripId/cancel', {});
  }

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = {'Content-Type': 'application/json'};
    if (auth) {
      final token = await _token();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body,
      {bool auth = true}) async {
    final response = await http.post(
      Uri.parse('$_baseUrl$path'),
      headers: await _headers(auth: auth),
      body: jsonEncode(body),
    );
    return _decode(response) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _patch(String path, Map<String, dynamic> body) async {
    final response = await http.patch(
      Uri.parse('$_baseUrl$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return _decode(response) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await http.get(Uri.parse('$_baseUrl$path'), headers: await _headers());
    return _decode(response) as Map<String, dynamic>;
  }

  Future<List<dynamic>> _getList(String path) async {
    final response = await http.get(Uri.parse('$_baseUrl$path'), headers: await _headers());
    return _decode(response) as List<dynamic>;
  }

  Future<dynamic> _getNullable(String path) async {
    final response = await http.get(Uri.parse('$_baseUrl$path'), headers: await _headers());
    return _decode(response);
  }

  dynamic _decode(http.Response response) {
    if (response.statusCode >= 400) {
      throw ApiException(response.statusCode, response.body);
    }
    if (response.body.isEmpty) return {};
    return jsonDecode(response.body);
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String body;
  ApiException(this.statusCode, this.body);

  @override
  String toString() => 'ApiException($statusCode): $body';
}
