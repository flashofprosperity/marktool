"""
Parse DirectDataLink_Data.xml and export XLSX with:
Line No., Line Name, Station No., Station Name (Postfix),
Station Idx, Function Unit, WorkPos, ToolPos, LocationID,
Event Name, EventSwitch, EventSwitch Response, Event Switch AnswerRequired,
Event Switch Postfix, Processing Step Constraint,
Processing Step (Process Module), Processing Step (Application),
Processing Step Command, Command Template Name
"""

import configparser
import xml.etree.ElementTree as ET

import openpyxl
from collections import defaultdict

_cfg = configparser.ConfigParser()
_cfg.read("config.ini")
XML_FILE = _cfg.get("files", "input", fallback="DirectDataLink_Data.xml")
OUT_FILE = _cfg.get("files", "output", fallback="output.xlsx")
print(f"Config  ->  input: {XML_FILE}  |  output: {OUT_FILE}")

NS = "Bosch.OpCon.Data"
NSP = "{" + NS + "}"


def ftext(elem, tag):
    """Get child element text, empty string if missing."""
    child = elem.find(NSP + tag)
    return (child.text or "") if child is not None else ""


print("Parsing XML (this may take a while)...")
tree = ET.parse(XML_FILE)
root = tree.getroot()
print("XML parsed. Building lookup tables...")

# ---- Lookup maps ----
lines = {}  # guid -> {LineNumber}
locations = {}  # guid -> {Line, Station, Postfix}
sub_locations = {}  # guid -> {FunctionUnit, StationIndex, WorkPos, ToolPos}
event_switch_defs = {}  # guid -> {EventSwitch, Postfix, AnswerRequired}
application_events = {}  # guid -> {RefEventName}
events_logic = {}  # guid -> Name  (DdlEventsLogicTable)
processing_steps = {}  # guid -> {Constraint, RefProcessModule, RefApplication}
psc_map = {}  # guid -> {RefCommand, RefTemplate}
ddl_station = {}  # guid -> {Name, ParentGuid, ClassGuid}
ddl_process = {}  # guid -> Name  (DdlProcessLogicTable)
ddl_comm_modules = {}  # guid -> Name

for elem in root:
    tag = elem.tag.replace(NSP, "")
    guid = ftext(elem, "Guid")
    if not guid:
        continue

    if tag == "Line":
        lines[guid] = {"LineNumber": ftext(elem, "LineNumber")}

    elif tag == "Location":
        locations[guid] = {
            "Line": ftext(elem, "Line"),
            "Station": ftext(elem, "Station"),
            "Postfix": ftext(elem, "Postfix"),
        }

    elif tag == "SubLocation":
        sub_locations[guid] = {
            "FunctionUnit": ftext(elem, "FunctionUnit"),
            "StationIndex": ftext(elem, "StationIndex"),
            "WorkPos": ftext(elem, "WorkPos"),
            "ToolPos": ftext(elem, "ToolPos"),
        }

    elif tag == "EventSwitchDefinition":
        event_switch_defs[guid] = {
            "EventSwitch": ftext(elem, "EventSwitch"),
            "Postfix": ftext(elem, "Postfix"),
        }

    elif tag == "ApplicationEvent":
        application_events[guid] = {
            "RefEventName": ftext(elem, "_Ref_EventName"),
        }

    elif tag == "DdlEventsLogicTable":
        events_logic[guid] = ftext(elem, "Name")

    elif tag == "ProcessingSteps":
        processing_steps[guid] = {
            "Constraint": ftext(elem, "Constraint"),
            "ExecutionStep": ftext(elem, "ExecutionStep"),
            "RefProcessModule": ftext(elem, "_Ref_ProcessModule"),
            "RefApplication": ftext(elem, "_Ref_Application"),
        }

    elif tag == "ProcessingStepCommands":
        psc_map[guid] = {
            "RefCommand": ftext(elem, "_Ref_Command"),
            "RefTemplate": ftext(elem, "_Ref_Template"),
        }

    elif tag == "DataCollectorLogicTable":
        ddl_comm_modules[guid] = ftext(elem, "Name")  # reuse map for template lookup

    elif tag == "DdlStationLogicTable":
        ddl_station[guid] = {
            "Name": ftext(elem, "Name"),
            "ParentGuid": ftext(elem, "ParentGuid"),
            "ClassGuid": ftext(elem, "ClassGuid"),
        }

    elif tag == "DdlProcessLogicTable":
        ddl_process[guid] = ftext(elem, "Name")

    elif tag in ("DdlCommModulesLogicTable", "ProcessingModulesAccessLogicTable"):
        if guid not in ddl_comm_modules:
            ddl_comm_modules[guid] = ftext(elem, "Name")

print(
    f"  Lines: {len(lines)}, Locations: {len(locations)}, SubLocations: {len(sub_locations)}"
)
print(
    f"  EventSwitchDefs: {len(event_switch_defs)}, ApplicationEvents: {len(application_events)}"
)
print(f"  ProcessingSteps: {len(processing_steps)}, PSC: {len(psc_map)}")
print(
    f"  DdlStationLogicTable entries: {len(ddl_station)}, DdlProcessLogicTable entries: {len(ddl_process)}"
)

# ---- Build parent->children map from DdlStationLogicTable ----
children = defaultdict(list)
for guid, info in ddl_station.items():
    parent = info["ParentGuid"]
    children[parent].append(guid)


def get_name(guid):
    return ddl_station.get(guid, {}).get("Name", "")


def parse_esd_name(esd_name):
    """Split Event Switch Name into (EventSwitch, EventSwitch Response).

    Expected format: 'EventSwitch -1 True Scanner get new component batch'
    Returns: ('-1', 'True')
    """
    parts = esd_name.split()
    # Strip leading 'EventSwitch' token if present
    if parts and parts[0].lower() == "eventswitch":
        parts = parts[1:]
    if len(parts) >= 2:
        return parts[0], parts[1]
    elif len(parts) == 1:
        return parts[0], ""
    return "", ""


print("Building rows...")
rows = []

for line_guid, line_data in lines.items():
    line_no = line_data["LineNumber"]
    line_name = get_name(line_guid)

    # Locations are children of Line in DdlStationLogicTable
    for loc_guid in children.get(line_guid, []):
        if loc_guid not in locations:
            continue
        loc = locations[loc_guid]
        station_no = loc["Station"]
        station_postfix = loc["Postfix"]

        # SubLocations are children of Location in DdlStationLogicTable
        for sub_guid in children.get(loc_guid, []):
            if sub_guid not in sub_locations:
                continue
            sub = sub_locations[sub_guid]
            stat_idx = sub["StationIndex"]
            func_unit = sub["FunctionUnit"]
            work_pos = sub["WorkPos"]
            tool_pos = sub["ToolPos"]
            location_id = (
                f"{line_no}.{station_no}.{stat_idx}.{func_unit}.{work_pos}.{tool_pos}"
            )

            # Find "Events" collection node (child of SubLocation named "Events")
            events_col_guid = None
            for child_guid in children.get(sub_guid, []):
                if get_name(child_guid) == "Events":
                    events_col_guid = child_guid
                    break
            if not events_col_guid:
                continue

            # ApplicationEvents are children of EventsCollection
            for ae_guid in children.get(events_col_guid, []):
                if ae_guid not in application_events:
                    continue
                ae = application_events[ae_guid]
                event_name = events_logic.get(ae["RefEventName"], ae["RefEventName"])

                # EventSwitchDefinitions are children of ApplicationEvent
                for esd_guid in children.get(ae_guid, []):
                    if esd_guid not in event_switch_defs:
                        continue
                    esd = event_switch_defs[esd_guid]
                    esd_name = get_name(esd_guid)  # e.g. "EventSwitch -1 False"
                    esd_postfix = esd["Postfix"]
                    es_switch, es_response = parse_esd_name(esd_name)

                    # ProcessingSteps are children of EventSwitchDefinition
                    for ps_guid in children.get(esd_guid, []):
                        if ps_guid not in processing_steps:
                            continue
                        ps = processing_steps[ps_guid]
                        ps_constraint = ps["Constraint"]
                        ps_execution_step = ps["ExecutionStep"]
                        ps_process_module = ddl_process.get(ps["RefProcessModule"], "")
                        ps_application = ddl_station.get(ps["RefApplication"], {}).get(
                            "Name", ""
                        )

                        # ProcessingStepCommands are children of ProcessingSteps
                        psc_children = [
                            g for g in children.get(ps_guid, []) if g in psc_map
                        ]

                        if psc_children:
                            for psc_guid in psc_children:
                                cmd_name = get_name(psc_guid)
                                tmpl_guid = psc_map[psc_guid]["RefTemplate"]
                                tmpl_name = ddl_comm_modules.get(tmpl_guid, "")
                                rows.append(
                                    [
                                        line_no,
                                        line_name,
                                        station_no,
                                        station_postfix,
                                        stat_idx,
                                        func_unit,
                                        work_pos,
                                        tool_pos,
                                        location_id,
                                        event_name,
                                        es_switch,
                                        es_response,
                                        esd_postfix,
                                        ps_constraint,
                                        ps_process_module,
                                        ps_application,
                                        ps_execution_step,
                                        cmd_name,
                                        tmpl_name,
                                    ]
                                )
                        else:
                            rows.append(
                                [
                                    line_no,
                                    line_name,
                                    station_no,
                                    station_postfix,
                                    stat_idx,
                                    func_unit,
                                    work_pos,
                                    tool_pos,
                                    location_id,
                                    event_name,
                                    es_switch,
                                    es_response,
                                    esd_postfix,
                                    ps_constraint,
                                    ps_process_module,
                                    ps_application,
                                    ps_execution_step,
                                    "",
                                    "",
                                ]
                            )


HEADERS = [
    "Line No.",
    "Line Name",
    "Station No.",
    "Station Name (Postfix)",
    "Station Idx",
    "Function Unit",
    "WorkPos",
    "ToolPos",
    "LocationID",
    "Event Name",
    "EventSwitch",
    "EventSwitch Response",
    "Event Switch Postfix",
    "Processing Step Constraint",
    "Processing Step (Process Module)",
    "Processing Step (Application)",
    "Processing Step (Execution Step)",
    "Processing Step Command",
    "Command Template Name",
]

print(f"Writing {len(rows)} rows to {OUT_FILE}...")
wb = openpyxl.Workbook()
ws = wb.active
ws.append(HEADERS)
for row in rows:
    ws.append(row)
wb.save(OUT_FILE)

print(f"Done! Output: {OUT_FILE}")
