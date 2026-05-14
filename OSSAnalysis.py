"""
Parse DirectDataLink_Data.xml and export XLSX with:
Line No., Line Name, Station No., Station Name (Postfix),
Station Idx, Function Unit, WorkPos, ToolPos, Location Postfix, LocationID,
Event Name, EventSwitch, EventSwitch Response, Event Switch AnswerRequired,
Event Switch Postfix, Processing Step Constraint,
Processing Step (Process Module), Processing Step (Application),
Processing Step Command, Command Template Name
"""

import configparser
import json
import os
import xml.etree.ElementTree as ET

import openpyxl
from collections import defaultdict

_cfg = configparser.ConfigParser()
_cfg.read("config.ini")
XML_FILE = _cfg.get("files", "input", fallback="DirectDataLink_Data.xml")
OUT_FILE = _cfg.get("files", "output", fallback="output.xlsx")
DDL_DIR = _cfg.get("files", "ddl_dir", fallback="DDL")
TEMPLATE_META_FILE = _cfg.get(
    "files", "template_meta", fallback="template_params.json"
)
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
inactive_guids = set()  # GUIDs where VarBaseData.Active == 'false'
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

    if tag == "VarBaseData":
        if ftext(elem, "Active") == "false":
            inactive_guids.add(guid)

    elif tag == "Line":
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
            "Postfix": ftext(elem, "Postfix"),
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

    elif tag in (
        "DdlCommModulesLogicTable",
        "ProcessingModulesAccessLogicTable",
        "RdcDatAccessLogicTable",
        "XmlAccessLogicTable",
        "PredefinedStructureAccessLogicTable",
    ):
        if guid not in ddl_comm_modules:
            ddl_comm_modules[guid] = ftext(elem, "Name")

print(f"  Inactive (deactivated) GUIDs: {len(inactive_guids)}")
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


def extract_template_meta_from_xml(xml_root, NSP):
    """Fallback: extract template metadata directly from DirectDataLink_Data.xml.

    Handles three module families:
      - DataCollector (DC): Templates → DataCollectorLogicTable groups →
            DataCollectorLogicTable fields → VariableMappingsDca (PlcSymbol/Direction)
      - Standard (LC/TC/MC etc.): Templates → ProcessingModulesAccessLogicTable groups →
            ProcessingModulesAccessLogicTable fields →
            ProcessingModulesEditorVariableMappingsPme (PlcSymbol/Direction/Expression)
      - PredefinedStructure (VA etc.): PredefinedStructureAccessLogicTable →
            _Ref_Root → Structure tree → PredefinedVariableMappings
    """
    from collections import defaultdict

    pmal_data = {}          # guid → {Name, ParentGuid}
    dcl_data = {}           # guid → {Name, ParentGuid}
    pme_data = {}           # guid → {PlcSymbol, Direction, Expression, DataType, Ignore}
    dca_data = {}           # guid → {PlcSymbol, Direction, DataType, Req}
    pm_type = {}            # guid → ProcessingModule.Type string
    templates_data = {}     # guid → {ProcessModuleGuid, _Ref_Root}
    template_name_fallback = {}  # guid -> Name from comm module tables
    psal_by_guid = {}       # guid → {Name, _Ref_Root} for PredefinedStructureAccessLogicTable
    pvar_data = {}          # guid → {PlcSymbol, Direction, DataType, Required}
    structure_children = defaultdict(list)  # for Structure hierarchy
    pval_children = defaultdict(list)       # PredefinedVariableMappings children
    pmal_children = defaultdict(list)
    dcl_children = defaultdict(list)
    mapping_tags = {
        "VariableMappings",
        "DocumentElements",
        "ExchangedVariables",
        "ExchangeVariables",
        "CommandValues",
    }
    raw_entries = []

    # First pass: collect PSAL and all supporting data
    print("  [Scan 1] Collecting PredefinedStructureAccessLogicTable...")
    for e in xml_root:
        tag = e.tag.replace(NSP, "")

        def _t(field, _e=e):
            c = _e.find(NSP + field)
            return (c.text or "") if c is not None else ""

        guid = _t("Guid")
        if not guid:
            continue

        if tag == "ProcessingModulesAccessLogicTable":
            pg = _t("ParentGuid")
            pmal_data[guid] = {"Name": _t("Name"), "ParentGuid": pg}
            if pg:
                pmal_children[pg].append(guid)

        elif tag == "DataCollectorLogicTable":
            pg = _t("ParentGuid")
            dcl_data[guid] = {"Name": _t("Name"), "ParentGuid": pg}
            if pg:
                dcl_children[pg].append(guid)

        elif tag == "PredefinedStructureAccessLogicTable":
            name = _t("Name")
            pg = _t("ParentGuid")
            # Collect all PSAL for building the tree, not just templates
            psal_by_guid[guid] = {
                "Name": name,
                "ParentGuid": pg,
                "_Ref_Root": "",
                "_is_leaf": False,  # Will be set to True if it has PlcSymbol data
            }
            if pg:
                pval_children[pg].append(guid)

        elif tag == "Structure":
            pg = _t("ParentGuid")
            if pg:
                structure_children[pg].append(guid)

        elif tag == "PredefinedVariableMappings":
            pg = _t("ParentGuid")
            pvar_data[guid] = {
                "PlcSymbol": _t("PlcSymbol"),
                "Direction": _t("Direction"),
                "DataType": _t("DataType"),
                "Required": _t("Required"),
            }
            if pg:
                pval_children[pg].append(guid)
            # Mark this PSAL as having leaf data (parameter data)
            if guid in psal_by_guid:
                psal_by_guid[guid]["_is_leaf"] = True

        elif tag == "ProcessingModulesEditorVariableMappingsPme":
            pme_data[guid] = {
                "PlcSymbol": _t("PlcSymbol"),
                "Direction": _t("Direction"),
                "Expression": _t("Expression"),
                "DataType": _t("DataType"),
                "Ignore": _t("Ignore"),
            }

        elif tag == "VariableMappingsDca":
            dca_data[guid] = {
                "PlcSymbol": _t("PlcSymbol"),
                "Direction": _t("Direction"),
                "DataType": _t("DataType"),
                "Req": _t("Req"),
            }

        elif tag == "ProcessingModule":
            pm_type[guid] = _t("Type")

        elif tag in (
            "DdlCommModulesLogicTable",
            "RdcDatAccessLogicTable",
            "XmlAccessLogicTable",
        ):
            template_name_fallback[guid] = _t("Name")

        elif tag in mapping_tags:
            template_id = _t("TemplateIdentifier")
            if template_id:
                fields = {c.tag.replace(NSP, ""): (c.text or "") for c in e}
                raw_entries.append((tag, fields))

    # Second pass: now that psal_by_guid is populated, collect Templates and link them
    print("  [Scan 2] Linking Templates to PredefinedStructureAccessLogicTable...")
    for e in xml_root:
        tag = e.tag.replace(NSP, "")

        def _t(field, _e=e):
            c = _e.find(NSP + field)
            return (c.text or "") if c is not None else ""

        guid = _t("Guid")
        if not guid:
            continue

        if tag == "Templates":
            templates_data[guid] = {
                "ProcessModuleGuid": _t("ProcessModuleGuid"),
                "_Ref_Root": _t("_Ref_Root"),
            }
            # Also store _Ref_Root for PredefinedStructure templates
            if guid in psal_by_guid:
                ref_root = _t("_Ref_Root")
                psal_by_guid[guid]["_Ref_Root"] = ref_root

    print(f"  [Result] Found {len(psal_by_guid)} PredefinedStructure templates")
    psal_with_ref = [t for t in psal_by_guid.values() if t.get("_Ref_Root")]
    print(f"  [Result] {len(psal_with_ref)} templates have _Ref_Root")


    def _iter_descendants(children_map, root_guid):
        """Yield all descendant GUIDs under root_guid (depth-first)."""
        stack = list(children_map.get(root_guid, []))
        while stack:
            gid = stack.pop()
            yield gid
            stack.extend(children_map.get(gid, []))

    def _infer_group_name(node_guid, data_map, root_guid):
        """Infer logical group name from ancestor chain, fallback to root name."""
        cur = data_map.get(node_guid, {}).get("ParentGuid", "")
        while cur and cur != root_guid:
            name = (data_map.get(cur, {}).get("Name") or "").strip()
            if name:
                return name
            cur = data_map.get(cur, {}).get("ParentGuid", "")

        root_name = (data_map.get(root_guid, {}).get("Name") or "").strip()
        return root_name

    def _ancestor_names(node_guid, data_map, root_guid):
        """Collect ancestor names (nearest first) for output/response heuristics."""
        out = []
        cur = data_map.get(node_guid, {}).get("ParentGuid", "")
        while cur:
            name = (data_map.get(cur, {}).get("Name") or "").strip()
            if name:
                out.append(name)
            if cur == root_guid:
                break
            cur = data_map.get(cur, {}).get("ParentGuid", "")
        return out

    def _field_path_name(node_guid, data_map, root_guid):
        """Build stable dotted path for nested fields (e.g. matData.matID)."""
        names = []
        cur = node_guid
        while cur and cur != root_guid:
            name = (data_map.get(cur, {}).get("Name") or "").strip()
            names.append(name)
            cur = data_map.get(cur, {}).get("ParentGuid", "")

        names.reverse()
        out = []
        for n in names:
            ln = n.lower()
            if not n or ln in ("request", "response"):
                continue
            # Collapse duplicated container names from array-like structures.
            if out and out[-1] == n:
                continue
            out.append(n)
        return ".".join(out)

    template_meta = {}
    template_by_id = {}

    for tmpl_guid, tmpl in templates_data.items():
        pm_guid = tmpl["ProcessModuleGuid"]
        ref_root = tmpl["_Ref_Root"]
        if not ref_root:
            continue

        pmt = pm_type.get(pm_guid, "")
        is_dc = "DataCollector" in pmt

        if is_dc:
            name_data = dcl_data.get(tmpl_guid)
            source = "DataCollectorAccess"
        else:
            name_data = pmal_data.get(tmpl_guid)
            # derive source from ProcessingModule.Type
            # e.g. "Bosch.OpCon.DDL.Modules.LineControlAccess.LineControlAccessModule"
            parts = pmt.split(".")
            source = parts[-2] if len(parts) >= 2 else (parts[-1] if parts else "Unknown")

        tmpl_name = ""
        if name_data:
            tmpl_name = name_data.get("Name", "")
        if not tmpl_name:
            tmpl_name = template_name_fallback.get(tmpl_guid, "")
        if not tmpl_name:
            continue

        template_by_id[tmpl_guid] = tmpl_name

        params = []
        outputs = []
        seen = set()

        if is_dc:
            for field_guid in _iter_descendants(dcl_children, ref_root):
                d = dca_data.get(field_guid)
                if not d:
                    continue

                field = dcl_data.get(field_guid, {})
                field_name = field.get("Name", "")
                grp_name = _infer_group_name(field_guid, dcl_data, ref_root)
                direction = d.get("Direction", "0")
                bucket = "outputs" if direction in ("1", "2") else "parameters"
                final_group = grp_name or ("response" if bucket == "outputs" else "request")

                dedup_key = (
                    field_guid,
                    field_name,
                    grp_name,
                    direction,
                    d.get("PlcSymbol", ""),
                )
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                item = {
                    "name": field_name,
                    "group": final_group,
                    "kind": "VariableMappingsDca",
                    "source_file": source,
                    "direction": direction,
                    "plc_symbol": d.get("PlcSymbol", ""),
                    "cmd_symbol": "",
                    "data_type": d.get("DataType", ""),
                    "required": d.get("Req", ""),
                    "expression": "",
                    "persistence_name": "",
                }
                if bucket == "outputs":
                    outputs.append(item)
                else:
                    params.append(item)
        else:
            for field_guid in _iter_descendants(pmal_children, ref_root):
                p = pme_data.get(field_guid)
                field = pmal_data.get(field_guid, {})
                field_name = field.get("Name", "")
                grp_name = _infer_group_name(field_guid, pmal_data, ref_root)
                anc_names = _ancestor_names(field_guid, pmal_data, ref_root)
                anc_norm = " ".join(anc_names).lower()
                grp_is_output = "response" in anc_norm or "output" in anc_norm

                is_leaf = len(pmal_children.get(field_guid, [])) == 0
                if p and p.get("Ignore", "false") == "true":
                    continue

                if p:
                    direction = p.get("Direction", "")
                    if direction in ("1", "2"):
                        bucket = "outputs"
                    elif direction == "0":
                        bucket = "parameters"
                    elif grp_is_output:
                        bucket = "outputs"
                    else:
                        bucket = "parameters"
                    final_group = grp_name or (
                        "response" if bucket == "outputs" else "request"
                    )

                    dedup_key = (
                        field_guid,
                        field_name,
                        grp_name,
                        direction,
                        p.get("PlcSymbol", ""),
                        p.get("Expression", ""),
                    )
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)

                    item = {
                        "name": field_name,
                        "group": final_group,
                        "kind": "VariableMappings",
                        "source_file": source,
                        "direction": direction,
                        "plc_symbol": p.get("PlcSymbol", ""),
                        "cmd_symbol": "",
                        "data_type": p.get("DataType", ""),
                        "required": "",
                        "expression": p.get("Expression", ""),
                        "persistence_name": "",
                    }
                else:
                    # Keep leaf structure fields even if no mapping row exists.
                    if not is_leaf:
                        continue
                    ln = field_name.lower().strip()
                    if ln in ("", "request", "response"):
                        continue

                    bucket = "outputs" if grp_is_output else "parameters"
                    final_group = "response" if bucket == "outputs" else "request"
                    display_name = _field_path_name(field_guid, pmal_data, ref_root) or field_name

                    dedup_key = (
                        field_guid,
                        display_name,
                        final_group,
                        "",
                        "",
                        "",
                    )
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)

                    item = {
                        "name": display_name,
                        "group": final_group,
                        "kind": "VariableMappings",
                        "source_file": source,
                        "direction": "",
                        "plc_symbol": "",
                        "cmd_symbol": "",
                        "data_type": "",
                        "required": "",
                        "expression": "",
                        "persistence_name": "",
                    }

                if bucket == "outputs":
                    outputs.append(item)
                else:
                    params.append(item)

        if not params and not outputs:
            continue

        template_meta[tmpl_name] = {
            "template_id": tmpl_guid,
            "source_file": source,
            "parameters": sorted(params, key=lambda x: x["name"]),
            "outputs": sorted(outputs, key=lambda x: x["name"]),
        }

    # Process PredefinedStructure templates (VA-prefixed commands)
    print(f"  [Scan 3] Processing {len(psal_by_guid)} PredefinedStructure templates...")
    ps_processed = 0
    for psal_guid, psal_info in psal_by_guid.items():
        ref_root = psal_info.get("_Ref_Root", "")
        if not ref_root:
            continue

        ps_processed += 1
        tmpl_name = psal_info.get("Name", "")
        if not tmpl_name:
            continue

        params = []
        outputs = []
        seen = set()

        # Get all descendant PSALs under _Ref_Root and extract their param data
        for desc_guid in _iter_descendants(pval_children, ref_root):
            pvar = pvar_data.get(desc_guid)
            if not pvar:
                continue

            plc_sym = pvar.get("PlcSymbol", "")
            direction = pvar.get("Direction", "0")
            data_type = pvar.get("DataType", "")
            required = pvar.get("Required", "")

            # Determine if output or parameter based on direction
            if direction in ("1", "2"):
                bucket = "outputs"
                group_name = "response"
            else:
                bucket = "parameters"
                group_name = "request"

            dedup_key = (desc_guid, plc_sym, direction)
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            item = {
                "name": plc_sym,  # Use PlcSymbol as parameter name
                "group": group_name,
                "kind": "PredefinedVariableMappings",
                "source_file": "PredefinedStructure",
                "direction": direction,
                "plc_symbol": plc_sym,
                "cmd_symbol": "",
                "data_type": data_type,
                "required": required,
                "expression": "",
                "persistence_name": "",
            }

            if bucket == "outputs":
                outputs.append(item)
            else:
                params.append(item)

        if not params and not outputs:
            continue

        template_meta[tmpl_name] = {
            "template_id": psal_guid,
            "source_file": "PredefinedStructure",
            "parameters": sorted(params, key=lambda x: x["name"]),
            "outputs": sorted(outputs, key=lambda x: x["name"]),
        }

    print(f"  [Result] Processed {ps_processed} PredefinedStructure templates")

    # Fallback extraction path: some templates are only exposed via
    # TemplateIdentifier-based mapping entries in main XML.
    raw_seen = set()
    for tag, fields in raw_entries:
        template_id = fields.get("TemplateIdentifier", "")
        if not template_id:
            continue

        tmpl_name = template_by_id.get(template_id) or template_name_fallback.get(
            template_id, ""
        )
        if not tmpl_name:
            continue

        if tmpl_name not in template_meta:
            template_meta[tmpl_name] = {
                "template_id": template_id,
                "source_file": "DirectDataLinkXml",
                "parameters": [],
                "outputs": [],
            }

        direction = fields.get("Direction", "")
        if direction in ("1", "2"):
            bucket = "outputs"
        elif direction == "0":
            bucket = "parameters"
        elif tag in ("ExchangedVariables", "ExchangeVariables"):
            bucket = "outputs"
        else:
            bucket = "parameters"

        dir_norm = direction.lower().replace("_", "")
        if dir_norm in ("out", "local"):
            bucket = "outputs"
        elif dir_norm in ("in", "inout"):
            bucket = "parameters"

        group_name = (
            fields.get("Group", "")
            or fields.get("Section", "")
            or ("response" if bucket == "outputs" else "request")
        )

        plc_symbol = fields.get("PlcSymbol", "")
        cmd_symbol = fields.get("CmdSymbol", "")
        persistence_name = fields.get("PersistenceName", "")
        display_name = cmd_symbol or plc_symbol or persistence_name or fields.get(
            "Name", ""
        )

        item = {
            "name": display_name or "(unnamed)",
            "group": group_name,
            "kind": tag,
            "source_file": "DirectDataLinkXml",
            "direction": direction,
            "plc_symbol": plc_symbol,
            "cmd_symbol": cmd_symbol,
            "data_type": fields.get("DataType", ""),
            "required": fields.get("Req", "") or fields.get("Required", ""),
            "expression": fields.get("Expression", ""),
            "persistence_name": persistence_name,
        }

        dedup_key = (
            tmpl_name,
            bucket,
            item["name"],
            item["kind"],
            item["plc_symbol"],
            item["cmd_symbol"],
            item["direction"],
            item["persistence_name"],
        )
        if dedup_key in raw_seen:
            continue
        raw_seen.add(dedup_key)
        template_meta[tmpl_name][bucket].append(item)

    for tmpl_name in template_meta:
        template_meta[tmpl_name]["parameters"].sort(
            key=lambda x: (x["name"], x.get("kind", ""))
        )
        template_meta[tmpl_name]["outputs"].sort(
            key=lambda x: (x["name"], x.get("kind", ""))
        )

    return template_meta


def extract_template_meta_from_ddl(ddl_dir):
    """Parse DDL access XML files and build template param/output metadata."""
    if not os.path.isdir(ddl_dir):
        print(f"DDL dir not found: {ddl_dir}, skip template metadata export.")
        return {}

    template_map = {}  # template_id -> {name, source_file}
    mapping_tags = {
        "VariableMappings",
        "DocumentElements",
        "ExchangedVariables",
        "ExchangeVariables",
        "CommandValues",
    }
    raw_entries = []

    for file_name in sorted(os.listdir(ddl_dir)):
        if not file_name.endswith(".xml"):
            continue
        file_path = os.path.join(ddl_dir, file_name)
        try:
            root = ET.parse(file_path).getroot()
        except ET.ParseError:
            continue

        for elem in root:
            tag = elem.tag.split("}")[-1]
            fields = {c.tag.split("}")[-1]: (c.text or "") for c in elem}

            if tag == "Templates":
                template_id = fields.get("Identifier", "")
                template_name = fields.get("Name", "")
                if template_id and template_name:
                    template_map[template_id] = {
                        "template_name": template_name,
                        "template_id": template_id,
                        "source_file": file_name,
                    }

            if tag in mapping_tags and fields.get("TemplateIdentifier", ""):
                raw_entries.append((tag, file_name, fields))

    template_meta = {}
    for template_info in template_map.values():
        template_meta[template_info["template_name"]] = {
            "template_id": template_info["template_id"],
            "source_file": template_info["source_file"],
            "parameters": [],
            "outputs": [],
        }

    seen = set()
    for tag, file_name, fields in raw_entries:
        template_id = fields.get("TemplateIdentifier", "")
        if not template_id or template_id not in template_map:
            continue

        template_name = template_map[template_id]["template_name"]
        plc_symbol = fields.get("PlcSymbol", "")
        cmd_symbol = fields.get("CmdSymbol", "")
        persistence_name = fields.get("PersistenceName", "")
        display_name = cmd_symbol or plc_symbol or persistence_name or fields.get(
            "Name", ""
        )
        direction = fields.get("Direction", "")

        # Direction heuristic: 0=input, 1/2=output. If no direction,
        # treat exchange tags as outputs and others as parameters.
        if direction in ("1", "2"):
            bucket = "outputs"
        elif direction == "0":
            bucket = "parameters"
        elif tag in ("ExchangedVariables", "ExchangeVariables"):
            bucket = "outputs"
        else:
            bucket = "parameters"

        # Override for text-based direction values (ExchangedVariables)
        if direction.lower() in ("out", "local"):
            bucket = "outputs"
        elif direction.lower() in ("in", "in_out"):
            bucket = "parameters"

        item = {
            "name": display_name or "(unnamed)",
            "kind": tag,
            "source_file": file_name,
            "direction": direction,
            "plc_symbol": plc_symbol,
            "cmd_symbol": cmd_symbol,
            "data_type": fields.get("DataType", ""),
            "required": fields.get("Req", "") or fields.get("Required", ""),
            "expression": fields.get("Expression", ""),
            "persistence_name": persistence_name,
        }

        dedup_key = (
            template_name,
            bucket,
            item["name"],
            item["kind"],
            item["plc_symbol"],
            item["cmd_symbol"],
            item["direction"],
            item["persistence_name"],
        )
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        template_meta[template_name][bucket].append(item)

    for template_name in template_meta:
        template_meta[template_name]["parameters"].sort(
            key=lambda x: (x["name"], x["kind"])
        )
        template_meta[template_name]["outputs"].sort(
            key=lambda x: (x["name"], x["kind"])
        )

    return template_meta


print("Building rows...")
rows = []

for line_guid, line_data in lines.items():
    if line_guid in inactive_guids:
        continue
    line_no = line_data["LineNumber"]
    line_name = get_name(line_guid)

    # Locations are children of Line in DdlStationLogicTable
    for loc_guid in children.get(line_guid, []):
        if loc_guid not in locations:
            continue
        if loc_guid in inactive_guids:
            continue
        loc = locations[loc_guid]
        station_no = loc["Station"]
        station_postfix = loc["Postfix"]

        # SubLocations are children of Location in DdlStationLogicTable
        for sub_guid in children.get(loc_guid, []):
            if sub_guid not in sub_locations:
                continue
            if sub_guid in inactive_guids:
                continue
            sub = sub_locations[sub_guid]
            stat_idx = sub["StationIndex"]
            func_unit = sub["FunctionUnit"]
            work_pos = sub["WorkPos"]
            tool_pos = sub["ToolPos"]
            loc_postfix = sub["Postfix"]
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
                if ae_guid in inactive_guids:
                    continue
                ae = application_events[ae_guid]
                event_name = events_logic.get(ae["RefEventName"], ae["RefEventName"])

                # EventSwitchDefinitions are children of ApplicationEvent
                for esd_guid in children.get(ae_guid, []):
                    if esd_guid not in event_switch_defs:
                        continue
                    if esd_guid in inactive_guids:
                        continue
                    esd = event_switch_defs[esd_guid]
                    esd_name = get_name(esd_guid)  # e.g. "EventSwitch -1 False"
                    esd_postfix = esd["Postfix"]
                    es_switch, es_response = parse_esd_name(esd_name)

                    # ProcessingSteps are children of EventSwitchDefinition
                    for ps_guid in children.get(esd_guid, []):
                        if ps_guid not in processing_steps:
                            continue
                        if ps_guid in inactive_guids:
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
                                        loc_postfix,
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
                                    loc_postfix,
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
    "Location Postfix",
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

template_meta = extract_template_meta_from_ddl(DDL_DIR)
if template_meta:
    with open(TEMPLATE_META_FILE, "w", encoding="utf-8") as fw:
        json.dump(template_meta, fw, ensure_ascii=False, indent=2)
    print("Template metadata exported: " + TEMPLATE_META_FILE + " (" + str(len(template_meta)) + " templates)")
else:
    print("DDL dir not available, extracting template metadata from main XML...")
    template_meta = extract_template_meta_from_xml(root, NSP)
    if template_meta:
        with open(TEMPLATE_META_FILE, "w", encoding="utf-8") as fw:
            json.dump(template_meta, fw, ensure_ascii=False, indent=2)
        print("Template metadata exported: " + TEMPLATE_META_FILE + " (" + str(len(template_meta)) + " templates)")
    else:
        print("Warning: could not extract template metadata.")
print("Done! Output: " + OUT_FILE)
