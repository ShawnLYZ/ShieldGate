from shieldgate.classify.patterns import luhn_ok, mask_text, scan


def types(text):
    return {m.type for m in scan(text)}


def test_luhn_valid_card_detected_and_masked():
    text = "please charge 4532-0151-1283-0366 for me"
    ms = [m for m in scan(text) if m.type == "card"]
    assert len(ms) == 1
    assert ms[0].masked == "4532-****-****-0366"
    assert text[ms[0].start:ms[0].end] == "4532-0151-1283-0366"


def test_luhn_invalid_number_not_a_card():
    assert "card" not in types("id 4532-0151-1283-0361 thanks")  # bad checksum


def test_malaysian_ic():
    assert "my_ic" in types("my ic is 020626-10-1234 ok")


def test_api_key_shapes():
    assert "api_key" in types("token sk-abcdEFGH1234567890xyz here")
    assert "api_key" in types("aws AKIAIOSFODNN7EXAMPLE")
    assert "api_key" in types("gsk_abc123DEF456ghi789JKL012")


def test_email_and_phone():
    assert "email" in types("mail me at jane.doe@corp.example.com")
    assert "phone" in types("call +60123456789 today")


def test_clean_text_no_matches():
    assert scan("summarise the quarterly all-hands agenda") == []


def test_mask_text_replaces_spans():
    text = "card 4532-0151-1283-0366 and mail a@b.co"
    out = mask_text(text, scan(text))
    assert "4532-0151-1283-0366" not in out
    assert "4532-****-****-0366" in out
    assert "a@b.co" not in out


def test_luhn_helper():
    assert luhn_ok("4532015112830366") is True
    assert luhn_ok("4532015112830361") is False
