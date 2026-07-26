import time

import backend.services.rag_service as rag_module


def test_successful_initialization_reuses_state(monkeypatch):
    service = rag_module.RAGService()
    calls = {"count": 0}

    def fake_lazy_init():
        calls["count"] += 1
        service.is_initialized = True
        service._init_state.state = "READY"

    monkeypatch.setattr(service, "_lazy_init", fake_lazy_init)

    assert service._ensure_initialized() is True
    assert service._ensure_initialized() is True
    assert calls["count"] == 1
    assert service.check_health()["status"] == "ready"


def test_permanent_failure_enters_degraded_mode_and_skips_retry(monkeypatch):
    service = rag_module.RAGService()
    service._init_state.state = "FAILED"
    service._init_state.failure_kind = "permanent"
    service._init_state.failure_reason = "missing DLL"
    service._init_state.exception_type = "ImportError"
    service._init_state.last_failure_at = time.time()

    calls = {"count": 0}

    def fake_lazy_init():
        calls["count"] += 1

    monkeypatch.setattr(service, "_lazy_init", fake_lazy_init)

    assert service._ensure_initialized() is False
    assert calls["count"] == 0
    health = service.check_health()
    assert health["status"] == "degraded"
    assert health["details"]["failure_kind"] == "permanent"


def test_retry_succeeds_after_cooldown(monkeypatch):
    service = rag_module.RAGService()
    service._init_state.state = "FAILED"
    service._init_state.failure_kind = "transient"
    service._init_state.last_failure_at = 100.0

    times = [100.0, 500.0]
    monkeypatch.setattr(rag_module.time, "time", lambda: times[0])

    calls = {"count": 0}

    def fake_lazy_init():
        calls["count"] += 1
        service.is_initialized = True
        service._init_state.state = "READY"

    monkeypatch.setattr(service, "_lazy_init", fake_lazy_init)

    assert service._ensure_initialized() is False
    assert calls["count"] == 0
    assert service.check_health()["status"] == "degraded"

    times[0] = 500.0
    assert service._ensure_initialized() is True
    assert calls["count"] == 1
    assert service.check_health()["status"] == "ready"
