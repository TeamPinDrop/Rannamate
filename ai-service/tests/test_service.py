from .conftest import CTX, KEY

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


def test_health_is_public_and_has_no_secrets(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["providers"] == {"active": None, "gemini": False, "claude": False}
    assert "test-internal-key" not in r.text


def test_internal_routes_need_the_service_key(client):
    assert client.post("/v1/mate/chat", json={"message": "hi"}).status_code == 401
    assert client.post("/v1/mate/chat", json={"message": "hi"}, headers={"X-Internal-Key": "wrong"}).status_code == 401


def test_no_model_key_is_an_honest_503(client):
    r = client.post("/v1/mate/chat", json={"message": "hi"}, headers=KEY)
    assert r.status_code == 503 and r.json()["detail"]["code"] == "AI_PROVIDER_NOT_CONFIGURED"


def test_mate_reply_is_normalised(client, fake):
    f = fake({"reply": "Step 2: add the onions.", "action": "next", "goToStep": 2, "timerSeconds": 0, "swapFrom": "garlic", "swapOptions": ["hing"]})
    r = client.post("/v1/mate/chat", headers=KEY, json={"message": "next", "recipe": {"name": "Dal", "steps": [{"text": "a"}, {"text": "b"}]}, "stepIndex": 0, "allergies": ["nuts"]})
    body = r.json()
    assert r.status_code == 200
    assert body["action"] == "next" and body["goToStep"] == 1 and body["timerSeconds"] is None
    assert body["swap"] == {"from": "garlic", "options": ["hing"]}
    assert "nuts" in f.calls[0]["system"]  # allergies reach the model as hard rules


def test_mate_out_of_range_step_is_dropped(client, fake):
    fake({"reply": "ok", "goToStep": 9})
    r = client.post("/v1/mate/chat", headers=KEY, json={"message": "go", "recipe": {"name": "Dal", "steps": [{"text": "a"}]}})
    assert r.json()["goToStep"] is None


def test_mate_empty_reply_is_rejected(client, fake):
    fake({"reply": "  "})
    r = client.post("/v1/mate/chat", headers=KEY, json={"message": "hi"})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "AI_INVALID_OUTPUT"


def test_trivia_valid_and_shuffled_consistently(client, fake):
    fake({"question": "Which country is sushi from?", "options": ["China", "Japan", "Thailand", "Korea"], "correctIndex": 1, "explanation": "Japan."})
    for _ in range(5):
        d = client.post("/v1/chill/activity", headers=KEY, json={"activity": "trivia", "ctx": CTX, "difficulty": "easy"}).json()["data"]
        assert d["options"][d["correct"]] == "Japan"


def test_trivia_with_duplicate_options_is_rejected(client, fake):
    fake({"question": "Q?", "options": ["A", "A", "B", "C"], "correctIndex": 0, "explanation": ""})
    assert client.post("/v1/chill/activity", headers=KEY, json={"activity": "trivia", "ctx": CTX}).status_code == 422


def test_guess_clue_that_gives_answer_away_is_rejected(client, fake):
    fake({"answer": "Onion", "aliases": ["pyaaz"], "clues": ["I am an onion", "b", "c"], "emoji": "🧅"})
    assert client.post("/v1/chill/activity", headers=KEY, json={"activity": "guess", "ctx": CTX}).status_code == 422


def test_riddle_containing_answer_is_rejected(client, fake):
    fake({"riddle": "I am an onion, what am I?", "answer": "onion", "aliases": [], "hint": "h"})
    assert client.post("/v1/chill/activity", headers=KEY, json={"activity": "riddles", "ctx": CTX}).status_code == 422


def test_story_is_forced_to_end_on_last_beat(client, fake):
    fake({"title": "T", "text": "And then...", "choices": ["x", "y"], "ending": False})
    r = client.post("/v1/chill/activity", headers=KEY, json={"activity": "story", "ctx": CTX, "maxBeats": 2, "beats": [{"text": "Once", "choice": "x"}]})
    d = r.json()["data"]
    assert d["ending"] is True and d["choices"] == []


def test_chat_instruction_rides_with_last_user_message(client, fake):
    f = fake({"reply": "Nice!", "cookingQuestion": False})
    client.post("/v1/chill/activity", headers=KEY, json={"activity": "chat", "ctx": CTX, "messages": [{"who": "mate", "text": "hi"}, {"who": "user", "text": "I love biryani"}]})
    turns = f.calls[0]["turns"]
    assert turns[-1].role == "user" and turns[-1].text.startswith("I love biryani") and len(turns) == 2


def test_song_prompt_forbids_copyrighted_lyrics(client, fake):
    f = fake({"title": "Dal Dance", "style": "jingle", "lines": ["a", "b", "c", "d"]})
    assert client.post("/v1/chill/activity", headers=KEY, json={"activity": "song", "ctx": CTX, "topic": "dal"}).status_code == 200
    assert "Never reproduce" in f.calls[0]["system"] and "ORIGINAL" in f.calls[0]["turns"][-1].text


def test_vision_rejects_non_images_and_cleans_output(client, fake):
    fake({"detections": [{"label": "Tomato", "confidence": 0.9}, {"label": "tomato", "confidence": 0.5}, {"label": "", "confidence": 1}, {"label": "onion", "confidence": 7}]})
    bad = client.post("/v1/vision/ingredients", headers=KEY, files={"image": ("x.txt", b"hello world, not an image", "text/plain")})
    assert bad.status_code == 415
    ok = client.post("/v1/vision/ingredients", headers=KEY, files={"image": ("x.jpg", JPEG, "image/jpeg")}).json()
    assert ok["detections"] == [{"label": "onion", "confidence": 1.0}, {"label": "tomato", "confidence": 0.9}]


def test_vision_too_large(client, fake):
    fake({"detections": []})
    big = JPEG + b"\x00" * (8 * 1024 * 1024)
    assert client.post("/v1/vision/ingredients", headers=KEY, files={"image": ("x.jpg", big, "image/jpeg")}).status_code == 413


def test_request_validation(client, fake):
    fake({})
    r = client.post("/v1/chill/activity", headers=KEY, json={"activity": "dance", "ctx": CTX})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "VALIDATION_FAILED"
