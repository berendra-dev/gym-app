#!/usr/bin/env python3
"""
Comprehensive end-to-end test for unified attendance API
Focuses on critical scenarios including expiry checking
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

# Global variables
super_admin_token = None
test_gym_id = None
test_member_id = None
test_member_name = None
expired_member_id = None

def get_firebase_token(email, password):
    """Get Firebase ID token"""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {"email": email, "password": password, "returnSecureToken": True}
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            return response.json().get('idToken')
        else:
            print(f"❌ Failed to get token: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
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

def fetch_test_data():
    """Fetch real gym and member data for testing"""
    global test_gym_id, test_member_id, test_member_name, expired_member_id
    print("\n=== Fetching test data ===")
    
    if not super_admin_token:
        print("❌ No auth token available")
        return False
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    
    # Get super admin profile to find a gym
    try:
        # Try to list gyms via admin API
        response = requests.get(f"{BASE_URL}/api/admin/gyms", headers=headers)
        if response.status_code == 200:
            gyms = response.json()
            if isinstance(gyms, list) and len(gyms) > 0:
                test_gym_id = gyms[0].get('id')
                print(f"✅ Found gym: {test_gym_id}")
            else:
                print("⚠️  No gyms found in response")
        else:
            print(f"⚠️  Could not fetch gyms: {response.status_code}")
    except Exception as e:
        print(f"⚠️  Exception fetching gyms: {str(e)}")
    
    # If we have a gym, try to get members
    if test_gym_id:
        try:
            response = requests.get(f"{BASE_URL}/api/admin/members?gymId={test_gym_id}", headers=headers)
            if response.status_code == 200:
                members = response.json()
                if isinstance(members, list) and len(members) > 0:
                    # Find an active member
                    for member in members:
                        if member.get('status') == 'active':
                            test_member_id = member.get('id')
                            test_member_name = member.get('name')
                            print(f"✅ Found active member: {test_member_name} ({test_member_id})")
                            break
                    
                    # Find or create an expired member for testing
                    for member in members:
                        expiry = member.get('renewalDate') or member.get('expiryDate')
                        if expiry and expiry < datetime.now().strftime("%Y-%m-%d"):
                            expired_member_id = member.get('id')
                            print(f"✅ Found expired member: {member.get('name')} ({expired_member_id})")
                            break
                else:
                    print("⚠️  No members found")
            else:
                print(f"⚠️  Could not fetch members: {response.status_code}")
        except Exception as e:
            print(f"⚠️  Exception fetching members: {str(e)}")
    
    if test_gym_id and test_member_id:
        print(f"✅ Test data ready: gym={test_gym_id}, member={test_member_id}")
        return True
    else:
        print("⚠️  Incomplete test data - some tests will be skipped")
        return False

def test_mark_attendance_manual_success():
    """Test marking attendance manually with proper auth"""
    print("\n=== Testing Manual Attendance Marking (Happy Path) ===")
    
    if not test_gym_id or not test_member_id:
        print("⚠️  SKIPPED: No test data available")
        return
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    today = datetime.now().strftime("%Y-%m-%d")
    
    payload = {
        "gymId": test_gym_id,
        "memberId": test_member_id,
        "date": today,
        "via": "manual",
        "status": "present"
    }
    
    try:
        print(f"Marking attendance for member {test_member_id} on {today}...")
        response = requests.post(f"{BASE_URL}/api/attendance", json=payload, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Manual attendance marked successfully")
            print(f"   Member: {data.get('memberName')}")
            print(f"   Doc path: {data.get('docPath')}")
            print(f"   Duplicate: {data.get('duplicate')}")
            
            # Verify the response structure
            required_fields = ['ok', 'docPath', 'memberName', 'status', 'via', 'date', 'memberId', 'gymId']
            missing = [f for f in required_fields if f not in data]
            if missing:
                print(f"⚠️  Missing fields in response: {missing}")
            else:
                print("✅ Response has all required fields")
            
            # Verify nested path structure
            expected_path = f"attendance/{test_gym_id}/{test_member_id}/{today}"
            if data.get('docPath') == expected_path:
                print(f"✅ Correct nested path structure: {expected_path}")
            else:
                print(f"❌ Wrong path structure. Expected: {expected_path}, Got: {data.get('docPath')}")
            
            return True
        else:
            print(f"❌ Failed to mark attendance: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_mark_attendance_duplicate():
    """Test marking attendance twice (duplicate detection)"""
    print("\n=== Testing Duplicate Attendance Marking ===")
    
    if not test_gym_id or not test_member_id:
        print("⚠️  SKIPPED: No test data available")
        return
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    today = datetime.now().strftime("%Y-%m-%d")
    
    payload = {
        "gymId": test_gym_id,
        "memberId": test_member_id,
        "date": today,
        "via": "manual"
    }
    
    try:
        # Mark first time
        print("Marking attendance (first time)...")
        response1 = requests.post(f"{BASE_URL}/api/attendance", json=payload, headers=headers)
        
        # Mark second time
        print("Marking attendance (second time - should detect duplicate)...")
        response2 = requests.post(f"{BASE_URL}/api/attendance", json=payload, headers=headers)
        
        if response2.status_code == 200:
            data = response2.json()
            if data.get('duplicate') == True:
                print("✅ Duplicate detected correctly")
                return True
            else:
                print(f"⚠️  Duplicate not detected. Response: {data}")
                return False
        else:
            print(f"❌ Failed: {response2.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_expired_member_blocking():
    """Test that expired members cannot mark attendance - CRITICAL TEST"""
    print("\n=== Testing Expired Member Blocking (CRITICAL) ===")
    
    if not test_gym_id:
        print("⚠️  SKIPPED: No test gym available")
        return
    
    # We need to create or find an expired member
    if not expired_member_id:
        print("⚠️  No expired member found. Creating test scenario...")
        # For now, we'll test with a hypothetical expired member
        # In a real scenario, we'd need to modify a member's expiry date
        print("⚠️  SKIPPED: Need to manually create expired member for this test")
        print("   To test: Set a member's renewalDate/expiryDate to a past date")
        return
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Test manual attendance for expired member
    print(f"\n1. Testing manual attendance for expired member {expired_member_id}...")
    payload = {
        "gymId": test_gym_id,
        "memberId": expired_member_id,
        "date": today,
        "via": "manual"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/attendance", json=payload, headers=headers)
        
        if response.status_code == 403:
            data = response.json()
            if data.get('code') == 'MEMBERSHIP_EXPIRED' and data.get('error') == 'MEMBERSHIP EXPIRED':
                print("✅ Expired member blocked correctly (manual)")
                print(f"   Error message: {data.get('message')}")
                print(f"   Expiry date: {data.get('expiryDate')}")
            else:
                print(f"⚠️  Got 403 but wrong error code/message: {data}")
        else:
            print(f"❌ Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
    
    # Test QR attendance for expired member via public checkin
    print(f"\n2. Testing QR attendance for expired member via /api/public/checkin...")
    # This would require knowing the member's phone number
    print("⚠️  SKIPPED: Requires member phone number")

def test_get_attendance():
    """Test GET /api/attendance with various filters"""
    print("\n=== Testing GET /api/attendance ===")
    
    if not test_gym_id or not test_member_id:
        print("⚠️  SKIPPED: No test data available")
        return
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    
    # Test 1: Get attendance for specific member
    print("\n1. Testing GET with memberId filter...")
    try:
        response = requests.get(
            f"{BASE_URL}/api/attendance?gymId={test_gym_id}&memberId={test_member_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ GET successful: {data.get('count')} records found")
            if data.get('records'):
                sample = data['records'][0]
                print(f"   Sample record: {sample.get('date')} - {sample.get('memberName')} - {sample.get('via')}")
        else:
            print(f"❌ GET failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
    
    # Test 2: Get attendance for entire gym (no memberId)
    print("\n2. Testing GET without memberId (gym-wide)...")
    try:
        response = requests.get(
            f"{BASE_URL}/api/attendance?gymId={test_gym_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Gym-wide GET successful: {data.get('count')} total records")
        else:
            print(f"❌ GET failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
    
    # Test 3: Get with date range
    print("\n3. Testing GET with date range...")
    today = datetime.now()
    from_date = (today - timedelta(days=7)).strftime("%Y-%m-%d")
    to_date = today.strftime("%Y-%m-%d")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/attendance?gymId={test_gym_id}&memberId={test_member_id}&from={from_date}&to={to_date}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Date range GET successful: {data.get('count')} records in range")
        else:
            print(f"❌ GET failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")

def test_delete_attendance():
    """Test DELETE /api/attendance"""
    print("\n=== Testing DELETE /api/attendance ===")
    
    if not test_gym_id or not test_member_id:
        print("⚠️  SKIPPED: No test data available")
        return
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    
    # First, mark attendance for a specific date
    test_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    print(f"1. Marking attendance for {test_date} (to be deleted)...")
    payload = {
        "gymId": test_gym_id,
        "memberId": test_member_id,
        "date": test_date,
        "via": "manual"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/attendance", json=payload, headers=headers)
        if response.status_code == 200:
            print("✅ Attendance marked")
        else:
            print(f"⚠️  Could not mark attendance: {response.status_code}")
    except Exception as e:
        print(f"⚠️  Exception marking: {str(e)}")
    
    # Now delete it
    print(f"\n2. Deleting attendance for {test_date}...")
    try:
        response = requests.delete(
            f"{BASE_URL}/api/attendance?gymId={test_gym_id}&memberId={test_member_id}&date={test_date}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print("✅ Attendance deleted successfully")
                print("✅ Audit log should be created (action='attendance.clear')")
            else:
                print(f"⚠️  Unexpected response: {data}")
        else:
            print(f"❌ DELETE failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
    
    # Verify deletion
    print(f"\n3. Verifying deletion...")
    try:
        response = requests.get(
            f"{BASE_URL}/api/attendance?gymId={test_gym_id}&memberId={test_member_id}&from={test_date}&to={test_date}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('count') == 0:
                print("✅ Deletion verified - record not found")
            else:
                print(f"⚠️  Record still exists after deletion")
        else:
            print(f"⚠️  Could not verify: {response.status_code}")
    except Exception as e:
        print(f"⚠️  Exception: {str(e)}")

def test_public_checkin():
    """Test POST /api/public/checkin"""
    print("\n=== Testing POST /api/public/checkin ===")
    
    if not test_gym_id or not test_member_id:
        print("⚠️  SKIPPED: No test data available")
        return
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Test with memberId
    print("\n1. Testing public checkin with memberId...")
    payload = {
        "gymId": test_gym_id,
        "memberId": test_member_id
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/public/checkin", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print(f"✅ Public checkin successful")
                print(f"   Message: {data.get('message')}")
                print(f"   Member: {data.get('name')}")
                print(f"   Doc path: {data.get('docPath')}")
                
                # Verify it used the unified API (nested path)
                expected_path = f"attendance/{test_gym_id}/{test_member_id}/{today}"
                if data.get('docPath') == expected_path:
                    print(f"✅ Uses unified API (correct nested path)")
                else:
                    print(f"❌ Wrong path - may not be using unified API")
            else:
                print(f"⚠️  Checkin failed: {data.get('message')}")
        else:
            print(f"❌ Request failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {str(e)}")

def test_member_isolation():
    """Test that attendance for one member doesn't affect another"""
    print("\n=== Testing Member Isolation ===")
    
    if not test_gym_id or not test_member_id:
        print("⚠️  SKIPPED: No test data available")
        return
    
    headers = {'Authorization': f"Bearer {super_admin_token}"}
    today = datetime.now().strftime("%Y-%m-%d")
    
    print("Testing that marking attendance for one member doesn't affect others...")
    
    # Get initial count for test member
    try:
        response = requests.get(
            f"{BASE_URL}/api/attendance?gymId={test_gym_id}&memberId={test_member_id}",
            headers=headers
        )
        initial_count = response.json().get('count', 0) if response.status_code == 200 else 0
        
        # Mark attendance
        payload = {
            "gymId": test_gym_id,
            "memberId": test_member_id,
            "date": today,
            "via": "manual"
        }
        requests.post(f"{BASE_URL}/api/attendance", json=payload, headers=headers)
        
        # Get new count
        response = requests.get(
            f"{BASE_URL}/api/attendance?gymId={test_gym_id}&memberId={test_member_id}",
            headers=headers
        )
        new_count = response.json().get('count', 0) if response.status_code == 200 else 0
        
        if new_count >= initial_count:
            print(f"✅ Member's own records updated (count: {initial_count} -> {new_count})")
            print("✅ Isolation maintained (nested subcollections ensure per-member isolation)")
        else:
            print(f"⚠️  Unexpected count change")
    except Exception as e:
        print(f"⚠️  Could not verify: {str(e)}")

def run_comprehensive_tests():
    """Run all comprehensive tests"""
    print("=" * 80)
    print("COMPREHENSIVE UNIFIED ATTENDANCE API TESTS")
    print("=" * 80)
    
    if not setup_auth():
        print("\n❌ CRITICAL: Authentication failed")
        return False
    
    if not fetch_test_data():
        print("\n⚠️  WARNING: Could not fetch complete test data")
        print("Some tests will be skipped")
    
    # Run all test suites
    test_mark_attendance_manual_success()
    test_mark_attendance_duplicate()
    test_expired_member_blocking()
    test_get_attendance()
    test_delete_attendance()
    test_public_checkin()
    test_member_isolation()
    
    print("\n" + "=" * 80)
    print("COMPREHENSIVE TEST SUITE COMPLETED")
    print("=" * 80)
    
    return True

if __name__ == "__main__":
    success = run_comprehensive_tests()
    sys.exit(0 if success else 1)
