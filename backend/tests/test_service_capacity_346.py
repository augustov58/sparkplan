"""
#346: the backend read projects.voltage / projects.phases, columns that don't
exist, so every service was taken as 240 V single-phase. Expected values are
the issue's hand calculation: capacity = A x V (1-phase) or A x V x sqrt(3)
(3-phase); a proposed load's amps are single-phase at the service voltage.

Run: cd backend && python -m pytest tests
"""
import asyncio
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from tools import database as db


def _service(project, panel_loads_va, additional_amps=None):
    """get_service_utilization / check_service_capacity on a stored project row."""
    async def get_project_data(_supabase, _project_id):
        return project

    async def get_all_panels(_supabase, _project_id):
        return [{"id": str(i)} for i in range(len(panel_loads_va))]

    async def calculate_total_panel_load(_supabase, panel_id):
        return panel_loads_va[int(panel_id)]

    with patch.object(db, "get_project_data", get_project_data), \
            patch.object(db, "get_all_panels", get_all_panels), \
            patch.object(db, "calculate_total_panel_load", calculate_total_panel_load):
        if additional_amps is None:
            return asyncio.run(db.get_service_utilization(None, "p"))
        return asyncio.run(db.check_service_capacity(None, "p", additional_amps))


def _row(amps, volts, phase):
    return {"service_amps": amps, "service_voltage": volts, "service_phase": phase}


@pytest.mark.parametrize("amps, volts, phase, kva", [
    (200, 240, 1, 48.0),    # unchanged
    (400, 208, 3, 144.1),   # main: 96.0
    (400, 480, 3, 332.6),   # main: 96.0
])
def test_service_capacity_reads_the_stored_service(amps, volts, phase, kva):
    result = _service(_row(amps, volts, phase), [0])
    assert (result["voltage"], result["phases"]) == (volts, phase)
    assert round(result["service_capacity_va"] / 1000, 1) == kva


def test_two_ev_chargers_on_a_208v_3phase_service_fit():
    # 400 A 208 V 3-phase, 80 kVA connected, + 2 x 40 A (1-phase at 208 V = 16,640 VA)
    result = _service(_row(400, 208, 3), [80_000], additional_amps=80)
    assert result["new_utilization_percent"] == 67.1          # main: 103.3
    assert result["requires_service_upgrade"] is False        # main: True
    assert result["can_proceed"] is True
    assert result["current_load_amps"] == 222.1               # 80,000 / (208 x sqrt 3)
    assert result["new_total_amps"] == 268.2                  # 96,640 / (208 x sqrt 3)


def test_single_phase_amps_unchanged():
    result = _service(_row(200, 240, 1), [24_000], additional_amps=40)
    assert (result["current_load_amps"], result["new_total_amps"]) == (100.0, 140.0)
    assert result["new_utilization_percent"] == 70.0


def test_describe_service_states_what_is_stored():
    assert db.describe_service(_row(400, 208, 3)) == "400A, 208V, 3-Phase"
    assert db.describe_service({}) == "?A, ?V, ?-Phase"


def test_panel_utilization_reads_num_spaces_and_3phase_amps():
    panel = {"id": "x", "name": "MDP", "bus_rating": 225, "voltage": 208, "phase": 3, "num_spaces": 30}
    query = SimpleNamespace(
        select=lambda *_: query, eq=lambda *_: query, single=lambda: query,
        execute=lambda: SimpleNamespace(data=panel),
    )
    supabase = SimpleNamespace(table=lambda _name: query)

    async def get_panel_circuits(_supabase, _panel_id):
        return [{"load_watts": 36_000, "pole": 3}]

    with patch.object(db, "get_panel_circuits", get_panel_circuits):
        result = asyncio.run(db.get_panel_utilization(supabase, "x"))
    assert result["total_spaces"] == 30                       # main: 42 (read 'spaces')
    assert round(result["capacity_va"]) == 81_060              # 225 x 208 x sqrt 3
    assert result["current_load_amps"] == 99.9                 # 36,000 / (208 x sqrt 3); main: 173.1
