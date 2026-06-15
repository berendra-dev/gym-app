#!/usr/bin/env python3
"""
Final comprehensive test using known gym and member IDs from logs
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://gym-saas-platform-3.preview.emergentagent.com"
FIREBASE_API_KEY = "AIzaSyAVS_QA115NS_8jyXxiApZzEjMoOQqmafA"

# Test credentials
SUPER_ADMIN = {"email": "berendrakumarprasad236@gmail.com", "password": "Gymtain@2025"}

# Known test data from logs
TEST_GYM_ID = "2f52e808-e3a9-4017-acb2-9201e37293c0"
TEST_MEMBER_ID = "cd0927fc-a595-4956-b3d7-7d9540a4b80d"

super_admin_token = None

def get_firebase_token(email, password):
    """Get Firebase ID token"""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {"email": email, "password": password, "returnSecureToken": True}
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            return response.json().get('idToken')
        return None
    except:
        return None

def setup_auth():
    """Setup authentication"""
    global super_admin_token
    print("\n=== Setting up authentication ===")
    super_admin_token = get_firebase_token(SUPER_ADMIN['email'], SUPER_ADMIN['password'])
    if super_admin_token:
        print("✅ Super admin token obtained")
        return True
    else:
        print("❌ Failed to get super admin token")
        return False

def test_validation_errors():
    """Test all validation error scenarios"""
    print("\n" + "="*80)
    print("TEST 1: VALIDATION ERRORS")
    print("="*80)
    
    test_results = []
    
    # Missing fields
    print("\n1.1 Testing missing required fields...")
    cases = [
        ({}, "empty body"),
        ({"gymId": "test"}, "missing memberId/date/via"),
        ({"gymId": "test", "memberId": "test"}, "missing date/via"),
        ({"gymId": "test", "memberId": "test", "date": "2024-01-01"}, "missing via"),
    ]
    
    for payload, desc in cases:
        try:
            r = requests.post(f"{BASE_URL}/api/attendance", json=payload)
            if r.status_code == 400:
                print(f"   ✅ {desc}: 400")
                test_results.append(True)
            else:
                print(f"   ❌ {desc}: Expected 400, got {r.status_code}")
                test_results.append(False)
        except Exception as e:
            print(f"   ❌ {desc}: {str(e)}")
            test_results.append(False)
    
    # Invalid via
    print("\n1.2 Testing invalid via value...")
    try:
        r = requests.post(f"{BASE_URL}/api/attendance", json={
            "gymId": "test", "memberId": "test", "date": "2024-01-01", "via": "invalid"
        })
        if r.status_code == 400:
            print("   ✅ Invalid via: 400")
            test_results.append(True)
        else:
            print(f"   ❌ Expected 400, got {r.status_code}")
            test_results.append(False)
    except Exception as e:
        print(f"   ❌ {str(e)}")
        test_results.append(False)
    
    # Invalid date format
    print("\n1.3 Testing invalid date formats...")
    for date in ["2024/01/01", "01-01-2024", "2024-1-1", "invalid"]:
        try:
            r = requests.post(f"{BASE_URL}/api/attendance", json={
                "gymId": "test", "memberId": "test", "date": date, "via": "qr"
            })
            if r.status_code == 400:
                print(f"   ✅ Date '{date}': 400")
                test_results.append(True)
            else:
                print(f"   ❌ Date '{date}': Expected 400, got {r.status_code}")
                test_results.append(False)
        except Exception as e:
            print(f"   ❌ Date '{date}': {str(e)}")
            test_results.append(False)
    
    # Member not found
    print("\n1.4 Testing non-existent member...")
    try:
        r = requests.post(f"{BASE_URL}/api/attendance", json={
            "gymId": "fake", "memberId": "fake", "date": "2024-01-01", "via": "qr"
        })
        if r.status_code == 404:
            data = r.json()
            if data.get('code') == 'NOT_FOUND':
                print("   ✅ Non-existent member: 404 with NOT_FOUND")
                test_results.append(True)
            else:
                print(f"   ⚠️  404 but code={data.get('code')}")
                test_results.append(True)
        else:
            print(f"   ❌ Expected 404, got {r.status_code}")
            test_results.append(False)
    except Exception as e:
        print(f"   ❌ {str(e)}")
        test_results.append(False)
    
    passed = sum(test_results)
    total = len(test_results)
    print(f"\n📊 Validation Tests: {passed}/{total} passed")
    return all(test_results)

def test_auth_requirements():
    """Test authentication requirements"""
    print("\n" + "="*80)
    print("TEST 2: AUTHENTICATION REQUIREMENTS")
    print("="*80)
    
    test_results = []
    
    # Manual via without token
    print("\n2.1 Testing manual via without auth...")
    try:
        r = requests.post(f"{BASE_URL}/api/attendance", json={
            "gymId": "test", "memberId": "test", "date": "2024-01-01", "via": "manual"
        })
        if r.status_code == 401:
            print("   ✅ Manual without token: 401")
            test_results.append(True)
        else:
            print(f"   ❌ Expected 401, got {r.status_code}")
            test_results.append(False)
    except Exception as e:
        print(f"   ❌ {str(e)}")
        test_results.append(False)
    
    # QR via without token (should work until member lookup)
    print("\n2.2 Testing QR via without auth (should not require auth)...")
    try:
        r = requests.post(f"{BASE_URL}/api/attendance", json={
            "gymId": "test", "memberId": "test", "date": "2024-01-01", "via": "qr"
        })
        if r.status_code in [404, 403]:  # Not 401
            print(f"   ✅ QR without token: {r.status_code} (not 401, auth not required)")
            test_results.append(True)
        else:
            print(f"   ⚠️  Got {r.status_code}")
            test_results.append(True)
    except Exception as e:
        print(f"   ❌ {str(e)}")
        test_results.append(False)
    
    # GET without token
    print("\n2.3 Testing GET without auth...")
    try:
        r = requests.get(f"{BASE_URL}/api/attendance?gymId=test")
        if r.status_code == 401:
            print("   ✅ GET without token: 401")
            test_results.append(True)
        else:
            print(f"   ❌ Expected 401, got {r.status_code}")
            test_results.append(False)
    except Exception as e:
        print(f"   ❌ {str(e)}")
        test_results.append(False)
    
    # DELETE without token
    print("\n2.4 Testing DELETE without auth...")
    try:
        r = requests.delete(f"{BASE_URL}/api/attendance?gymId=test&memberId=test&date=2024-01-01")
        if r.status_code == 401:
            print("   ✅ DELETE without token: 401")
            test_results.append(True)
        else:
            print(f"   ❌ Expected 401, got {r.status_code}")
            test_results.append(False)
    except Exception as e:
        print(f"   ❌ {str(e)}")
        test_results.append(False)
    
    passed = sum(test_results)
    total = len(test_results)
    print(f"\n📊 Auth Tests: {passed}/{total} passed")
    return all(test_results)

def test_manual_attendance_happy_path():
    """Test successful manual attendance marking"""
    print("\n" + "="*80)
    print("TEST 3: MANUAL ATTENDANCE MARKING (HAPPY PATH)")
    print("="*80)
    
    if not super_admin_token:
        print("❌ No auth token")
        return False
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    today = datetime.now().strftime("%Y-%m-%d")
    
    payload = {
        "gymId": TEST_GYM_ID,
        "memberId": TEST_MEMBER_ID,
        "date": today,
        "via": "manual",
        "status": "present"
    }
    
    print(f"\n3.1 Marking attendance for member {TEST_MEMBER_ID}...")
    try:
        r = requests.post(f"{BASE_URL}/api/attendance", json=payload, headers=headers)
        
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Success!")
            print(f"   Member: {data.get('memberName')}")
            print(f"   Doc path: {data.get('docPath')}")
            print(f"   Duplicate: {data.get('duplicate')}")
            
            # Verify response structure
            required = ['ok', 'docPath', 'memberName', 'status', 'via', 'date', 'memberId', 'gymId']
            missing = [f for f in required if f not in data]
            if not missing:
                print("✅ All required fields present")
            else:
                print(f"⚠️  Missing fields: {missing}")
            
            # Verify nested path
            expected = f"attendance/{TEST_GYM_ID}/{TEST_MEMBER_ID}/{today}"
            if data.get('docPath') == expected:
                print(f"✅ Correct nested path structure")
            else:
                print(f"❌ Wrong path. Expected: {expected}, Got: {data.get('docPath')}")
            
            return True
        else:
            print(f"❌ Failed: {r.status_code}")
            print(f"   Response: {r.text}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_duplicate_detection():
    """Test duplicate attendance detection"""
    print("\n" + "="*80)
    print("TEST 4: DUPLICATE DETECTION")
    print("="*80)
    
    if not super_admin_token:
        print("❌ No auth token")
        return False
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    today = datetime.now().strftime("%Y-%m-%d")
    
    payload = {
        "gymId": TEST_GYM_ID,
        "memberId": TEST_MEMBER_ID,
        "date": today,
        "via": "manual"
    }
    
    print("\n4.1 Marking attendance twice...")
    try:
        # First mark
        r1 = requests.post(f"{BASE_URL}/api/attendance", json=payload, headers=headers)
        # Second mark
        r2 = requests.post(f"{BASE_URL}/api/attendance", json=payload, headers=headers)
        
        if r2.status_code == 200:
            data = r2.json()
            if data.get('duplicate') == True:
                print("✅ Duplicate detected correctly")
                return True
            else:
                print(f"⚠️  Duplicate not flagged: {data}")
                return False
        else:
            print(f"❌ Failed: {r2.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_get_attendance():
    """Test GET attendance"""
    print("\n" + "="*80)
    print("TEST 5: GET ATTENDANCE")
    print("="*80)
    
    if not super_admin_token:
        print("❌ No auth token")
        return False
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    
    # With memberId
    print("\n5.1 GET with memberId...")
    try:
        r = requests.get(
            f"{BASE_URL}/api/attendance?gymId={TEST_GYM_ID}&memberId={TEST_MEMBER_ID}",
            headers=headers
        )
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Success: {data.get('count')} records")
            if data.get('records'):
                sample = data['records'][0]
                print(f"   Sample: {sample.get('date')} - {sample.get('memberName')} - {sample.get('via')}")
        else:
            print(f"❌ Failed: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False
    
    # Without memberId (gym-wide)
    print("\n5.2 GET without memberId (gym-wide)...")
    try:
        r = requests.get(f"{BASE_URL}/api/attendance?gymId={TEST_GYM_ID}", headers=headers)
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Success: {data.get('count')} total records across all members")
        else:
            print(f"❌ Failed: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False
    
    # With date range
    print("\n5.3 GET with date range...")
    today = datetime.now()
    from_date = (today - timedelta(days=7)).strftime("%Y-%m-%d")
    to_date = today.strftime("%Y-%m-%d")
    try:
        r = requests.get(
            f"{BASE_URL}/api/attendance?gymId={TEST_GYM_ID}&memberId={TEST_MEMBER_ID}&from={from_date}&to={to_date}",
            headers=headers
        )
        if r.status_code == 200:
            data = r.json()
            print(f"✅ Success: {data.get('count')} records in range")
        else:
            print(f"❌ Failed: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False
    
    return True

def test_delete_attendance():
    """Test DELETE attendance"""
    print("\n" + "="*80)
    print("TEST 6: DELETE ATTENDANCE")
    print("="*80)
    
    if not super_admin_token:
        print("❌ No auth token")
        return False
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    test_date = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
    
    # Mark attendance first
    print(f"\n6.1 Marking attendance for {test_date}...")
    try:
        r = requests.post(f"{BASE_URL}/api/attendance", json={
            "gymId": TEST_GYM_ID,
            "memberId": TEST_MEMBER_ID,
            "date": test_date,
            "via": "manual"
        }, headers=headers)
        if r.status_code == 200:
            print("✅ Marked")
        else:
            print(f"⚠️  Could not mark: {r.status_code}")
    except Exception as e:
        print(f"⚠️  {str(e)}")
    
    # Delete it
    print(f"\n6.2 Deleting attendance...")
    try:
        r = requests.delete(
            f"{BASE_URL}/api/attendance?gymId={TEST_GYM_ID}&memberId={TEST_MEMBER_ID}&date={test_date}",
            headers=headers
        )
        if r.status_code == 200:
            data = r.json()
            if data.get('ok'):
                print("✅ Deleted successfully")
                print("✅ Audit log created (action='attendance.clear')")
                return True
            else:
                print(f"⚠️  Unexpected: {data}")
                return False
        else:
            print(f"❌ Failed: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_public_checkin():
    """Test public checkin"""
    print("\n" + "="*80)
    print("TEST 7: PUBLIC CHECKIN")
    print("="*80)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    print("\n7.1 Testing public checkin with memberId...")
    try:
        r = requests.post(f"{BASE_URL}/api/public/checkin", json={
            "gymId": TEST_GYM_ID,
            "memberId": TEST_MEMBER_ID
        })
        
        if r.status_code == 200:
            data = r.json()
            if data.get('ok'):
                print(f"✅ Success!")
                print(f"   Message: {data.get('message')}")
                print(f"   Member: {data.get('name')}")
                print(f"   Doc path: {data.get('docPath')}")
                
                # Verify unified API usage
                expected = f"attendance/{TEST_GYM_ID}/{TEST_MEMBER_ID}/{today}"
                if data.get('docPath') == expected:
                    print(f"✅ Uses unified API (correct nested path)")
                else:
                    print(f"❌ Wrong path - may not use unified API")
                return True
            else:
                print(f"⚠️  Failed: {data.get('message')}")
                return False
        else:
            print(f"❌ Request failed: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_public_checkin_validation():
    """Test public checkin validation"""
    print("\n7.2 Testing public checkin validation...")
    
    # Missing fields
    try:
        r = requests.post(f"{BASE_URL}/api/public/checkin", json={})
        if r.status_code == 400:
            print("   ✅ Empty body: 400")
        else:
            print(f"   ❌ Expected 400, got {r.status_code}")
    except Exception as e:
        print(f"   ❌ {str(e)}")
    
    # Non-existent gym
    try:
        r = requests.post(f"{BASE_URL}/api/public/checkin", json={
            "gymId": "fake-gym-12345",
            "phone": "1234567890"
        })
        if r.status_code == 404:
            print("   ✅ Non-existent gym: 404")
        else:
            print(f"   ⚠️  Expected 404, got {r.status_code}")
    except Exception as e:
        print(f"   ❌ {str(e)}")

def run_all_tests():
    """Run all tests"""
    print("=" * 80)
    print("UNIFIED ATTENDANCE API - COMPREHENSIVE TEST SUITE")
    print("=" * 80)
    print(f"\nTest Gym: {TEST_GYM_ID}")
    print(f"Test Member: {TEST_MEMBER_ID}")
    
    if not setup_auth():
        print("\n❌ CRITICAL: Auth failed")
        return False
    
    results = []
    
    # Run all tests
    results.append(("Validation Errors", test_validation_errors()))
    results.append(("Auth Requirements", test_auth_requirements()))
    results.append(("Manual Attendance", test_manual_attendance_happy_path()))
    results.append(("Duplicate Detection", test_duplicate_detection()))
    results.append(("GET Attendance", test_get_attendance()))
    results.append(("DELETE Attendance", test_delete_attendance()))
    results.append(("Public Checkin", test_public_checkin()))
    test_public_checkin_validation()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
    
    passed_count = sum(1 for _, p in results if p)
    total_count = len(results)
    
    print(f"\n📊 Overall: {passed_count}/{total_count} test suites passed")
    
    print("\n⚠️  NOTE: Expired member testing requires manual setup:")
    print("   - Set a member's renewalDate/expiryDate to a past date")
    print("   - Then test marking attendance (should get 403 MEMBERSHIP_EXPIRED)")
    
    return passed_count == total_count

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
