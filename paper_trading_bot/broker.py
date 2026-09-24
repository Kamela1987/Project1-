"""Thin REST client for Binance's spot **testnet** (https://testnet.binance.vision).

Testnet accounts trade with fake funds on a real, live order book - so this
places real orders, just never with real money. Never point this module's
BASE_URL at the production Binance API and never load production API keys
into BINANCE_API_KEY / BINANCE_API_SECRET.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from urllib.parse import urlencode

import requests

BASE_URL = "https://testnet.binance.vision"


class BinanceError(RuntimeError):
    pass


class TestnetClient:
    def __init__(self, api_key: str | None, api_secret: str | None, timeout: float = 10.0):
        self.api_key = api_key
        self.api_secret = api_secret
        self.timeout = timeout
        self.session = requests.Session()
        if api_key:
            self.session.headers.update({"X-MBX-APIKEY": api_key})

    # -- public endpoints, no key needed --------------------------------

    def klines(self, symbol: str, interval: str, limit: int = 100) -> list[list]:
        resp = self.session.get(
            f"{BASE_URL}/api/v3/klines",
            params={"symbol": symbol, "interval": interval, "limit": limit},
            timeout=self.timeout,
        )
        self._raise_for_status(resp)
        return resp.json()

    def closes(self, symbol: str, interval: str, limit: int = 100) -> list[float]:
        return [float(row[4]) for row in self.klines(symbol, interval, limit)]

    # -- signed endpoints, need a testnet API key/secret -----------------

    def _signed_request(self, method: str, path: str, params: dict) -> dict:
        if not self.api_key or not self.api_secret:
            raise BinanceError(
                "BINANCE_TESTNET_API_KEY / BINANCE_TESTNET_API_SECRET are not set - "
                "get free testnet keys at https://testnet.binance.vision/"
            )
        params = dict(params)
        params["timestamp"] = int(time.time() * 1000)
        query = urlencode(params)
        signature = hmac.new(
            self.api_secret.encode(), query.encode(), hashlib.sha256
        ).hexdigest()
        params["signature"] = signature
        resp = self.session.request(
            method, f"{BASE_URL}{path}", params=params, timeout=self.timeout
        )
        self._raise_for_status(resp)
        return resp.json()

    def account(self) -> dict:
        return self._signed_request("GET", "/api/v3/account", {})

    def market_order(self, symbol: str, side: str, quote_order_qty: float) -> dict:
        """Place a MARKET order sized in quote currency (e.g. spend $50 of USDT)."""
        return self._signed_request(
            "POST",
            "/api/v3/order",
            {
                "symbol": symbol,
                "side": side,  # "BUY" or "SELL"
                "type": "MARKET",
                "quoteOrderQty": quote_order_qty,
            },
        )

    @staticmethod
    def _raise_for_status(resp: requests.Response) -> None:
        if resp.status_code >= 400:
            raise BinanceError(f"{resp.status_code} {resp.request.method} {resp.url}: {resp.text}")
