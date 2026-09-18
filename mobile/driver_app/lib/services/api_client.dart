import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static const _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  Future<String?> _token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('accessToken');
  }

  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', token);
  }

  Future<Map<String, dynamic>> requestOtp(String phoneNumber) {
    return _post('/auth/request-otp', {'phoneNumber': phoneNumber}, auth: false);
  }

  Future<String> verifyOtp(String phoneNumber, String otp, {String? name}) async {
    final body = await _post('/auth/verify-otp', {
      'phoneNumber': phoneNumber,
      'otp': otp,
      if (name != null) 'name': name,
      'role': 'driver',
    }, auth: false);
    final token = body['accessToken'] as String;
    await saveToken(token);
    return token;
  }

  Future<Map<String, dynamic>> registerDriver(String licenseNumber) {
    return _post('/drivers/register', {'licenseNumber': licenseNumber});
  }

  Future<Map<String, dynamic>> me() {
    return _get('/drivers/me');
  }

  Future<Map<String, dynamic>> myWallet() {
    return _get('/drivers/me/wallet');
  }

  Future<Map<String, dynamic>> registerVehicle({
    required String type,
    required String plateNumber,
  }) {
    return _post('/drivers/vehicle', {'type': type, 'plateNumber': plateNumber});
  }

  Future<Map<String, dynamic>> setOnline(bool isOnline) {
    return _patch('/drivers/online', {'isOnline': isOnline});
  }

  Future<List<dynamic>> availableTrips() {
    return _getList('/trips/available');
  }

  Future<Map<String, dynamic>> getTrip(String tripId) {
    return _get('/trips/$tripId');
  }

  Future<Map<String, dynamic>> acceptTrip(String tripId) {
    return _patch('/trips/$tripId/accept', {});
  }

  Future<Map<String, dynamic>> markArrived(String tripId) {
    return _patch('/trips/$tripId/arrived', {});
  }

  Future<Map<String, dynamic>> startTrip(String tripId) {
    return _patch('/trips/$tripId/start', {});
  }

  Future<Map<String, dynamic>> completeTrip(String tripId, double fareAmount) {
    return _patch('/trips/$tripId/complete', {'fareAmount': fareAmount});
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
