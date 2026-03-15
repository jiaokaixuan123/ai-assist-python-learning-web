"""
API 测试脚本 - 测试所有后端接口
运行：python test_api.py
"""
import requests
import json

BASE = "http://localhost:8000"
token = None
user_id = None

def test(name, fn):
    try:
        fn()
        print(f"[PASS] {name}")
        return True
    except AssertionError as e:
        print(f"[FAIL] {name}")
        print(f"       Assertion: {e}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"[FAIL] {name}")
        print(f"       Network: {e}")
        return False
    except Exception as e:
        print(f"[FAIL] {name}")
        print(f"       Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_root():
    r = requests.get(f"{BASE}/")
    assert r.status_code == 200
    assert "message" in r.json()

def test_register():
    global token, user_id
    r = requests.post(f"{BASE}/api/auth/register", json={
        "username": "testuser",
        "password": "test123",
        "email": "test@example.com"
    })
    assert r.status_code == 200
    data = r.json()
    token = data["access_token"]
    assert token

def test_login():
    global token
    r = requests.post(f"{BASE}/api/auth/login", json={
        "username": "testuser",
        "password": "test123"
    })
    assert r.status_code == 200
    token = r.json()["access_token"]

def test_me():
    global user_id
    r = requests.get(f"{BASE}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    user_id = r.json()["id"]

def test_courses_list():
    r = requests.get(f"{BASE}/api/courses")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_course_detail():
    r = requests.get(f"{BASE}/api/courses")
    courses = r.json()
    if courses:
        cid = courses[0]["id"]
        r2 = requests.get(f"{BASE}/api/courses/{cid}")
        assert r2.status_code == 200
        assert "lessons" in r2.json()

def test_exercises_list():
    r = requests.get(f"{BASE}/api/exercises")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_exercise_detail():
    r = requests.get(f"{BASE}/api/exercises")
    exercises = r.json()
    if exercises:
        eid = exercises[0]["id"]
        r2 = requests.get(f"{BASE}/api/exercises/{eid}")
        assert r2.status_code == 200
        assert "test_cases" in r2.json()

def test_submit():
    r = requests.get(f"{BASE}/api/exercises")
    exercises = r.json()
    if exercises:
        eid = exercises[0]["id"]
        r2 = requests.post(f"{BASE}/api/exercises/submissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"exercise_id": eid, "code": "print(1)", "passed": False, "result": "测试"}
        )
        assert r2.status_code == 200

def test_progress():
    r = requests.get(f"{BASE}/api/progress/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200

if __name__ == "__main__":
    print("=== 后端 API 测试 ===\n")
    test("根路径", test_root)
    test("用户注册", test_register)
    test("用户登录", test_login)
    test("获取当前用户", test_me)
    test("课程列表", test_courses_list)
    test("课程详情", test_course_detail)
    test("练习题列表", test_exercises_list)
    test("练习题详情", test_exercise_detail)
    test("提交判题", test_submit)
    test("学习进度", test_progress)
    print("\n测试完成")
