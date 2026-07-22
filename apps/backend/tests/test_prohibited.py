from shieldgate.approvals.prohibited import prohibited_check


def test_covert_monitoring_rejected():
    assert prohibited_check("EmployeeWatch", "covertly monitor staff keystrokes") is not None


def test_undisclosed_profiling_rejected():
    assert prohibited_check("ProfileAI", "secretly profile employees without their knowledge") is not None


def test_biometric_without_consent_rejected():
    assert prohibited_check("FaceScan", "biometric identification of visitors without consent") is not None


def test_normal_tool_allowed():
    assert prohibited_check("NoteGenius", "summarize meeting notes for the team") is None


async def test_intake_auto_rejects(db):
    from datetime import datetime, timezone

    from shieldgate.approvals.engine import create_request
    r = await create_request(db, tool_name="SpyTool", tool_url="https://spy.example",
                             requester_profile=None, requester_pseudonym="EMP-D3A1",
                             department="Engineering",
                             purpose="covertly track employees without disclosure",
                             clock=lambda: datetime(2026, 7, 16, tzinfo=timezone.utc))
    assert r["status"] == "auto_rejected"
