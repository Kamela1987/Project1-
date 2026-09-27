def ussd(client, text, phone="0977000111", session="s1"):
    return client.post(
        "/ussd",
        data={"sessionId": session, "phoneNumber": phone, "text": text},
    )


def test_ussd_main_menu(client):
    response = ussd(client, "")
    assert response.status_code == 200
    assert response.text.startswith("CON Monze Farm & Market Link")


def test_ussd_check_price_with_no_reports(client):
    response = ussd(client, "1")
    assert response.text.startswith("END")
    assert "No maize prices reported yet" in response.text


def test_ussd_report_price_full_flow(client):
    assert ussd(client, "3").text.startswith("CON Which commodity?")
    assert ussd(client, "3*1").text.startswith("CON Enter price in Kwacha")

    response = ussd(client, "3*1*380")
    assert response.text == "END Thanks! Recorded maize at K380.00 per 50kg bag."

    check = ussd(client, "1", session="s2")
    assert check.text == "END Avg maize price (last 1 reports): K380.00 per 50kg bag"


def test_ussd_report_price_invalid_amount(client):
    ussd(client, "3")
    ussd(client, "3*1")
    response = ussd(client, "3*1*notanumber")
    assert response.text == "END Invalid price. Please dial again and enter numbers only."


def test_ussd_report_disease_alert_flow(client):
    assert ussd(client, "4").text.startswith("CON Describe")
    assert ussd(client, "4*coughing cattle").text.startswith("CON Which area")

    response = ussd(client, "4*coughing cattle*Chivuna")
    assert response.text == "END Thanks! Your alert has been sent for verification."

    alerts = client.get("/alerts").json()
    assert len(alerts) == 1
    assert alerts[0]["disease"] == "coughing cattle"
    assert alerts[0]["location"] == "Chivuna"
    assert alerts[0]["verified"] is False


def test_ussd_invalid_option(client):
    response = ussd(client, "9")
    assert response.text == "END Invalid option. Please try again."
