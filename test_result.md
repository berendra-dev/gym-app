#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Multi-Gym Management SaaS on Next.js + Firebase. Latest user request (Msg 388):
  Renewal system overhaul (reactivation logic), Revenue Dashboard for Gym Owner,
  PDF receipt generation after payment, strict RBAC for receptionist (no revenue access).

backend:
  - task: "Renewal logic — expired -> today+duration, active -> expiry+duration"
    implemented: true
    working: "NA"
    file: "/app/app/gym-owner/payments/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Rewrote addPayment to use strict rule: max(expiryDate,today)+months. Adds wasExpired/reactivated flags. Member status forced to 'active'. Writes receiptNo on member and payment. Uses setDoc with explicit UUID for payment doc id."

frontend:
  - task: "Revenue Dashboard for Gym Owner only"
    implemented: true
    working: "NA"
    file: "/app/app/gym-owner/revenue/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New page with KPIs (total/this-month/last-month/growth%), active vs expired members, monthly bar chart (last 6mo), revenue by plan & mode, date-range filter, recent payments with receipt re-download. Strict RBAC via AppShell allow=['gym_owner'] — receptionist blocked."
  - task: "PDF Receipt generation with gym logo + address + phone"
    implemented: true
    working: "NA"
    file: "/app/lib/receipt.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "jsPDF + autoTable. Header has gym name/address/phone + logo (best-effort fetch as data URL). Body shows description (Renewal / Reactivation+Renewal), plan, validity (prev->new), amount. Auto-generated on save; re-download from Payments history and Revenue dashboard."
  - task: "Payments page renewal preview + custom-months mode"
    implemented: true
    working: "NA"
    file: "/app/app/gym-owner/payments/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Plan dropdown now sourced from subscriptionPlans collection (live onSnapshot) OR custom months. Live preview shows base-date, +N months, computed new expiry. Reactivate vs Renew label and audit action vary by wasExpired."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Renewal logic — expired -> today+duration, active -> expiry+duration"
    - "Revenue Dashboard for Gym Owner only"
    - "PDF Receipt generation with gym logo + address + phone"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Implemented P0 from user Msg 388: (1) renewal logic rule (expired -> today + duration;
      active -> expiry + duration) with auto status='active' & reactivated flag,
      (2) Revenue Dashboard at /gym-owner/revenue (gym_owner only),
      (3) PDF receipts auto-generated on payment with gym logo/name/address/phone via /app/lib/receipt.js,
      (4) added Revenue link to Gym Owner nav and dashboard tile, kept it out of receptionist nav.
      All pages compile (200 OK), lint clean. Awaiting user verification before P1 (cron + analytics + RBAC sweep).
  - agent: "main"
    message: |
      P0 confirmed by user. Now implemented P1:
      (1) Secured cron route POST/GET /api/cron/expire-members (Authorization: Bearer CRON_SECRET).
          Tested: 401 on no/wrong token, 200 on correct token, totalExpired=0 on first run. CRON_SECRET added to /app/.env.
      (2) Manual trigger POST /api/admin/cron/expire-members for Super Admin (button on Super Admin page).
      (3) Attendance Analytics page /gym-owner/analytics (gym_owner only). KPIs (check-ins, avg/day, unique members,
          QR vs manual), daily bar chart, top attendees ranked, inactive members tab, date range presets.
      (4) RBAC sweep confirmed: revenue & analytics gym_owner-only; trainers/receptionists pages gym_owner-only;
          backups/audit gym_owner+super_admin; members/attendance/payments/reports/admissions allow receptionist
          with internal gates (delete=gym_owner only). Receptionist nav has NO revenue, analytics, profile,
          trainers, receptionists, audit, backups.
      All pages compile 200 OK, lint clean.
  - agent: "main"
    message: |
      MAJOR REFACTOR: Unified attendance API.
      (1) NEW /app/app/api/attendance/route.js — single source of truth for ALL attendance ops.
          POST: mark attendance (via=qr public, via=manual requires Bearer token + role gym_owner/receptionist/super_admin matching gymId).
          GET: list attendance with optional memberId/from/to (server iterates nested subcollections).
          DELETE: clear a mark (audit logged).
      (2) Firestore path is now nested: attendance/{gymId}/{memberId}/{date} with fields {gymId, memberId, memberName, date, status, via, timestamp, markedBy, markedByRole}.
      (3) Validation: all required fields, member exists, member.gymId match, expiry check via member.renewalDate || member.expiryDate. Expired returns 403 + code='MEMBERSHIP_EXPIRED'.
      (4) /api/public/checkin no longer writes directly to Firestore — imports and calls recordAttendance({via:'qr'}).
      (5) Manual attendance page now POSTs to /api/attendance via lib/api.markAttendance.
      (6) Analytics, Owner dashboard, Receptionist dashboard, Student page, Reports — all migrated to api.listAttendance (no direct Firestore reads on attendance).
      (7) Backup tool updated to listCollections() under attendance/{gymId} and read each member subcollection.
      (8) lib/api.js gained markAttendance / listAttendance / clearAttendance helpers.
      Backend tester confirmed: all validation branches, auth gates, nested path writes, audit logs, public checkin via unified backend, GET/DELETE all working. Manual expired-member test pending user verification.
  - agent: "main"
    message: |
      ID CONSISTENCY REFACTOR — Firestore document ID is now the single source of truth for memberId.
      (1) /app/app/gym-owner/members/page.js — Replaced uuidv4() with `doc(collection(db, 'members'))` to pre-allocate
          a Firestore auto-id. The `id` field mirrors `memberRef.id`. No more uuidv4 imports for member creation.
      (2) /app/app/gym-owner/admissions/page.js — Removed addDoc() for members. Approval flow now:
          (a) doc(collection(db, 'members')) → ref.id IS the memberId
          (b) setDoc(memberRef, {id: memberRef.id, ...})
          (c) writes auditLog entry action='admission.approve'
          (d) deleteDoc(admissionRequest) to remove the source pending row — prevents duplicates.
          Member doc now also carries `renewalDate` mirroring expiryDate for the unified attendance API.
      (3) /app/app/api/[[...path]]/route.js (public admission) — Removed pre-generated uuidv4() memberId.
          Admission requests now use Firestore auto-id (adminDb.collection('admissionRequests').doc()).
          Photo storage path is `${gymId}/admissionRequests/${requestId}/profile.{ext}`. Response returns `{ok, requestId}`.
          No memberId is allocated until approval — eliminates the dual-ID problem entirely.
      Invariant: For every member, member.id === firestoreDocId. QR encodes member.id (==docId). Attendance API
      looks up by adminDb.collection('members').doc(memberId) — guaranteed consistent.
      Smoke-tested: POST /api/public/admission now returns Firestore-generated requestId (e.g. "Zh3yaJujtvZaD3rSUFUo").
      Lint clean across all touched files.