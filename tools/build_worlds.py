#!/usr/bin/env python3
"""Build the worlds-3d data layer: 7 flagship world JSONs + shared data + GLB assets.
Ground truth: fabric JSONs under rp1-review/push-6-fabrics, hub scene JSON,
agents.json (Virtuals), worlds.json (544-world list). No coordinates/models invented.
Run: python3 tools/build_worlds.py  (writes worlds/, data/, assets/glb/, WORLDS-NOTE.md)
"""
import json, os, re, shutil, hashlib

BASE = os.path.expanduser("~/workspace/your_files")
BUILD = os.path.join(BASE, "worlds-3d")
FAB_LOCAL = {
    "holodeck": "rp1-review/push-6-fabrics/site/my-fabric/holodeck.json",
    "cognition": "rp1-review/push-6-fabrics/site/my-fabric/cognition.json",
    "locator": "rp1-review/push-6-fabrics/site/my-fabric/worlds/locator-x/world.json",
    "biota": "rp1-review/push-6-fabrics/site/my-fabric/worlds/biota-blockchain/world.json",
    "empathic": "rp1-review/push-6-fabrics/site/my-fabric/worlds/empathic-x/world.json",
    "diagnostic": "rp1-review/push-6-fabrics/site/my-fabric/worlds/diagnostic-x/world.json",
}
FAB_URL = {
    "holodeck": "https://agifuturefoundation.github.io/WorldForge-Browser/my-fabric/holodeck.json",
    "cognition": "https://agifuturefoundation.github.io/WorldForge-Browser/my-fabric/cognition.json",
    "locator": "https://agifuturefoundation.github.io/WorldForge-Browser/my-fabric/worlds/locator-x/world.json",
    "biota": "https://agifuturefoundation.github.io/WorldForge-Browser/my-fabric/worlds/biota-blockchain/world.json",
    "empathic": "https://agifuturefoundation.github.io/WorldForge-Browser/my-fabric/worlds/empathic-x/world.json",
    "diagnostic": "https://agifuturefoundation.github.io/WorldForge-Browser/my-fabric/worlds/diagnostic-x/world.json",
}
COORDS = {
    "holodeck": (39.84645175015757, -86.621608018757),
    "cognition": (45.483127839031816, 18.572453605834877),
    "locator": (21.09705311564314, 142.69254864512746),
    "biota": (-38.71260348427612, -27.248278366617797),
    "empathic": (47.43990000744796, -179.34952851914045),
    "diagnostic": (5.342706937662501, 101.5663444901012),
}
# Virtuals agents (from worlds-hub-fellowship-chat/agents.json, verified 2026-11-06).
# All 5 instances are OFFLINE (listed on ACP, no instance deployed) — companions here
# are game characters representing the agents, NOT live connections.
COMPANIONS = {
    "omega": {"id": "omega", "name": "Omega", "role": "Hive coordination agent (Virtuals ACP). Real job: hive_coordination_brief, $10 / 24h. Game companion only — live instance offline.",
              "color": "#e2b55c"},
    "tactile": {"id": "tactile", "name": "Tactile", "role": "Workflow agent (Virtuals ACP). Real job: workflow_plan, $10 / 24h. Game companion only — live instance offline.",
                "color": "#6fd3c1"},
    "als": {"id": "als", "name": "ALS Researcher", "role": "Compound-library research agent (Virtuals ACP). Real job: compound_library_snapshot, $10 / 24h. Game companion only — live instance offline.",
            "color": "#8ecae6"},
    "cmmc": {"id": "cmmc", "name": "CMMC", "role": "Compliance-readiness agent (Virtuals ACP). Real job: readiness_check. Game companion only — live instance offline.",
             "color": "#f4a261"},
    "wave": {"id": "wave", "name": "WAVE", "role": "Bioacoustics agent (Virtuals ACP). Real job: species_identification. Game companion only — live instance offline.",
             "color": "#b5179e"},
}

def load(rel):
    with open(os.path.join(BASE, rel)) as f:
        return json.load(f)

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def scene(rel):
    return load(rel)["Data"]["Scene"]

def walk_nodes(node):
    yield node
    for c in node.get("aChildren", []) or []:
        yield from walk_nodes(c)

def distinct_refs(sc):
    out = []
    for n in walk_nodes(sc):
        r = (n.get("Resource") or {}).get("sReference")
        if r and r not in out:
            out.append(r)
    return sorted(out)

def top_children(sc):
    return sc.get("aChildren", []) or []

def pos_of(node):
    p = (node.get("Transform") or {}).get("Position") or [0, 0, 0]
    return [float(p[0]), float(p[1]), float(p[2]) if len(p) > 2 else 0.0]

def tx(pos, scale, off=(0, 0, 0)):
    """Fabric plan coords [x, y, 0] -> engine [x*s+ox, z-height, y*s+oz]."""
    return [round(pos[0] * scale + off[0], 2), round(pos[2] * scale, 2),
            round(pos[1] * scale + off[2], 2)]

def add(p, q):
    return [p[0] + q[0], p[1] + q[1], p[2] + q[2]]

def missing(sc):
    return [{"ref": r, "status": "not hosted — procedural placeholder shown"}
            for r in distinct_refs(sc)]

def npc(nid, name, role, position, dialogue, quest=None):
    return {"id": nid, "name": name, "role": role, "position": position,
            "dialogue": dialogue, "quest": quest}

def quest(qid, title, description, steps, reward):
    return {"id": qid, "title": title, "description": description,
            "steps": [{"text": t, "target": tg, "kind": k} for t, tg, k in steps],
            "reward": reward}

def coll(cid, name, position, kind):
    return {"id": cid, "name": name, "position": position, "kind": kind}

def building(bid, name, position, size, color, model_ref, rooms):
    return {"id": bid, "name": name, "position": position, "size": size,
            "color": color,
            "interior": {"name": name + " Interior",
                         "rooms": [{"name": rn, "size": rs, "props": pr}
                                   for rn, rs, pr in rooms]}}

def district(did, name, position, color, model_ref):
    return {"id": did, "name": name, "position": position, "color": color,
            "model_ref": model_ref, "model_status": "not hosted — procedural placeholder shown"}

FABRIC_MAP_NOTE = ("engine_x = fabric_x * scale + offset_x; engine_y = fabric_z * scale "
                   "(fabric z is height, 0 for plan nodes); engine_z = fabric_y * scale + offset_z")

def base_world(wid, name, series, status, coords, fabric_url, biome, spawn, terrain,
               weather, scale, off, fabric_key, fabric_nodes_total, fabric_nodes_used):
    lat, lon = coords if coords else (None, None)
    return {
        "id": wid, "name": name, "series": series, "status": status, "rp1": None,
        "coordinates": ({"lat": lat, "lon": lon} if coords else None),
        "fabric_url": fabric_url, "biome": biome, "spawn": spawn,
        "terrain": terrain, "weather": weather,
        "fabric_transform": {"scale": scale, "offset": list(off), "mapping": FABRIC_MAP_NOTE},
        "fabric_nodes_total": fabric_nodes_total,
        "fabric_nodes_used": fabric_nodes_used,
        "districts": [], "buildings": [], "npcs": [], "quests": [],
        "collectibles": [], "agent_companions": [], "missing_models": [],
        "sources": [],
    }

# ---------------------------------------------------------------- Holodeck (S10)
def build_holodeck():
    sc = scene(FAB_LOCAL["holodeck"])
    scale, off = 0.15, (0, 0, 0)
    w = base_world("smartciti-holodeck", "SmartCiti.X Holodeck", "Series 10 · SmartCiti.X",
                   "anchored", COORDS["holodeck"], FAB_URL["holodeck"], "city",
                   [0, 0, 24], {"size": 160, "height": 6, "seed": 1010, "water": False},
                   {"preset": "clear", "dayCycle": True}, scale, off, "holodeck", 131,
                   "8 top-level District nodes as districts; 12 Structural District halls + "
                   "11 Sim nodes as buildings (131 fabric nodes total; halls of the other 7 "
                   "districts are named in sources, not built as separate buildings)")
    palette = ["#c0392b", "#d35400", "#b7950b", "#1e8449", "#2471a3", "#6c3483", "#117a65", "#7e5109"]
    districts = [c for c in top_children(sc) if c["Name"].endswith("District")]
    sims = [c for c in top_children(sc) if c["Name"].startswith("Sim ")]
    for i, d in enumerate(districts):
        w["districts"].append(district(slug(d["Name"]), d["Name"], tx(pos_of(d), scale, off),
                                       palette[i % len(palette)], d["Resource"]["sReference"]))
    struct = next(d for d in districts if d["Name"] == "Structural District")
    hall_pos = {}
    for h in struct.get("aChildren", []) or []:
        p = tx(pos_of(h), scale, off)
        hall_pos[h["Name"]] = p
        w["buildings"].append(building(
            slug(h["Name"]), h["Name"], p, [14, 8, 14], "#c0392b",
            h["Resource"]["sReference"],
            [("Training Floor", [12, 6, 12], []), ("Tool Crib", [6, 4, 6], [])]))
    for s in sims:
        p = tx(pos_of(s), scale, off)
        w["buildings"].append(building(
            slug(s["Name"]), s["Name"], p, [8, 4, 8], "#2471a3",
            s["Resource"]["sReference"],
            [("Sim Bay", [7, 3, 7], [])]))
    # NPCs: the Holodeck fabric has NO "Agent · ..." nodes, so NPC roles are named after
    # real fabric hall nodes. All dialogue is original game dialogue, not attributed words.
    w["npcs"] = [
        npc("ironworkers-foreman", "Ironworkers Foreman", "Ironworkers hall lead",
            hall_pos["Ironworkers"],
            ["First day on the deck? Watch the crane, mind your tie-off, and ask before you lift.",
             "The Ironworkers hall runs the steel. Earn the lift and the crew has your back."],
            "q-structural-circuit"),
        npc("welding-instructor", "Welding Instructor", "Welding Trades hall instructor",
            hall_pos["Welding Trades"],
            ["A clean bead starts before the arc — clean metal, steady hand, right heat.",
             "Run the sim bay first. The bead never lies, but the sim lets you try again."],
            "q-clean-bead"),
        npc("crane-operator-lead", "Crane Operator Lead", "Crane Operators hall lead",
            hall_pos["Crane Operators"],
            ["Every lift is a conversation between the operator and the signalperson.",
             "Learn the signals cold. On this deck, a missed signal is a missed lift."],
            "q-first-lift"),
        npc("riggers-signal-lead", "Riggers & Signalpersons Lead", "Riggers & Signalpersons hall lead",
            hall_pos["Riggers & Signalpersons"],
            ["Rigging is trust you can measure — check the sling, check the angle, check again.",
             "Signal clear and the load moves. Signal sloppy and nothing moves at all."],
            "q-first-lift"),
    ]
    w["quests"] = [
        quest("q-first-lift", "First Lift",
              "Learn the crane signals and complete your first supervised lift.",
              [("Talk to the Crane Operator Lead", "crane-operator-lead", "npc"),
               ("Collect the lift spark at the Tower Crane sim", "spark-crane", "collectible"),
               ("Stand in the Tower Crane Lift sim bay", "Sim · Tower Crane Lift", "place")],
              "Crane Signal Badge"),
        quest("q-clean-bead", "Clean Bead",
              "Run the weld sim and bring back a bead worth showing.",
              [("Talk to the Welding Instructor", "welding-instructor", "npc"),
               ("Collect the weld relic from the Weld Bead sim", "relic-weld", "collectible"),
               ("Stand in the Weld Bead Run sim bay", "Sim · Weld Bead Run", "place")],
              "Welder's Mark"),
        quest("q-structural-circuit", "Structural Circuit",
              "Walk the Structural District and meet the halls that raise the steel.",
              [("Visit the Structural District", "Structural District", "place"),
               ("Collect the iron spark at the Ironworkers hall", "spark-iron", "collectible"),
               ("Talk to the Ironworkers Foreman", "ironworkers-foreman", "npc")],
              "Structural Circuit Badge"),
    ]
    sim_pos = {s["Name"]: tx(pos_of(s), scale, off) for s in sims}
    w["collectibles"] = [
        coll("spark-crane", "Crane Spark", add(sim_pos["Sim · Tower Crane Lift"], [2, 1, 0]), "spark"),
        coll("relic-weld", "Weld Relic", add(sim_pos["Sim · Weld Bead Run"], [2, 1, 0]), "relic"),
        coll("spark-iron", "Iron Spark", add(hall_pos["Ironworkers"], [3, 1, 0]), "spark"),
        coll("spark-rigging", "Rigging Spark", add(sim_pos["Sim · Rigging Signal Call"], [2, 1, 0]), "spark"),
        coll("data-loadchart", "Load Chart Data", add(sim_pos["Sim · Load Chart Judgment"], [2, 1, 0]), "data"),
        coll("spark-scaffold", "Scaffold Spark", add(sim_pos["Sim · Scaffold Bay Build"], [2, 1, 0]), "spark"),
        coll("relic-crane", "Crane Relic", add(hall_pos["Crane Operators"], [3, 1, 0]), "relic"),
        coll("spark-boom", "Boom Lift Spark", add(sim_pos["Sim · Boom Lift Basket Work"], [2, 1, 0]), "spark"),
    ]
    w["agent_companions"] = [COMPANIONS["tactile"], COMPANIONS["omega"]]
    w["missing_models"] = missing(sc)
    w["sources"] = [
        "Fabric: rp1-review/push-6-fabrics/site/my-fabric/holodeck.json (local copy in data/fabrics/holodeck.json)",
        "Fabric live URL: " + FAB_URL["holodeck"],
        "Anchor: lat 39.84645175015757, lon -86.621608018757 (Indianapolis / SmartCiti.X Holodeck anchor). Status anchored = real-world anchor coordinate exists; rp1 null, NOT live on RP1.",
        "Fabric: 131 nodes total (scene root + 19 top-level + 111 nested); 124 distinct GLB refs, all unhosted — see missing_models.",
        "Districts = the 8 real top-level '* District' nodes. Buildings = the 12 real Structural District halls (Ironworkers, Welding Trades, Boilermakers, Millwrights, Riggers & Signalpersons, Crane Operators, Steel Erectors, Structural Fabricators, Shipfitters, Metal Deck Installers, Precast Erectors, Piling Crews) + the 11 real 'Sim · ...' nodes. Halls of the other 7 districts (Envelope & Finish, Building Systems, Energy & Utilities, Earthworks & Plant, Heavy Industry, Transport & Mobility, Survey Safety & Environment) are real fabric nodes not built as separate buildings in this pass — see WORLDS-NOTE.md.",
        "NPCs: the Holodeck fabric has no 'Agent · ...' nodes; NPC roles are named after real fabric hall nodes and all dialogue is original game dialogue, never attributed to a real person.",
        "Biome 'city' is a design choice for this interpretation.",
        "Agent companions are game characters representing the real Virtuals agents (agents.json); their live instances are offline — not live connections.",
    ]
    return w

# ---------------------------------------------------------------- Cognition (S1)
def build_cognition():
    sc = scene(FAB_LOCAL["cognition"])
    scale, off = 0.25, (0, 0, 0)
    w = base_world("cognition-x", "Cognition.X Campus", "Series 1 · Cognition.X",
                   "anchored", COORDS["cognition"], FAB_URL["cognition"], "campus",
                   [0, 0, 20], {"size": 120, "height": 4, "seed": 101, "water": False},
                   {"preset": "clear", "dayCycle": True}, scale, off, "cognition", 26,
                   "All 25 top-level pack nodes as buildings; 5 of them also serve as districts")
    nodes = top_children(sc)
    node_pos = {n["Name"]: tx(pos_of(n), scale, off) for n in nodes}
    district_names = ["K–12", "Health & Community", "Basic Life Skills & Self-Reliance",
                      "Money, Benefits & Entitlements", "Cognition.X : Robotics OS"]
    palette = ["#2471a3", "#1e8449", "#b7950b", "#6c3483", "#117a65"]
    for i, dn in enumerate(district_names):
        w["districts"].append(district(slug(dn), dn, node_pos[dn], palette[i],
                                       next(n["Resource"]["sReference"] for n in nodes if n["Name"] == dn)))
    for n in nodes:
        w["buildings"].append(building(
            slug(n["Name"]), n["Name"], node_pos[n["Name"]], [12, 7, 12], "#2471a3",
            n["Resource"]["sReference"],
            [("Learning Hall", [10, 5, 10], []), ("Practice Room", [5, 4, 5], [])]))
    w["npcs"] = [
        npc("k12-teacher", "K–12 Teacher", "K–12 pack teacher",
            node_pos["K–12"],
            ["Every big skill starts small. Pick one thing, practice it, and come show me.",
             "The campus is a map of everything worth learning — you get to choose the route."],
            "q-first-lesson"),
        npc("trade-instructor", "Trade School Instructor", "Trade School pack instructor",
            node_pos["Trade School"],
            ["A trade is a promise you can keep with your hands. Start with the basics.",
             "Measure twice, cut once — and when the sim lets you retry, retry until it sticks."],
            "q-trade-path"),
        npc("future-work-coach", "Future-Work Coach", "Future-Work pack coach",
            node_pos["Future-Work"],
            ["The work of tomorrow rewards people who keep learning. What do you want to try next?",
             "Bring me one spark from each row and we will map your next step together."],
            "q-trade-path"),
        npc("health-guide", "Preventive Health Guide", "Preventive Health & Everyday Care pack guide",
            node_pos["Preventive Health & Everyday Care"],
            ["Small daily habits are the cheapest medicine there is. Start with one.",
             "Check in with yourself the way you would check in with a friend."],
            "q-healthy-day"),
    ]
    w["quests"] = [
        quest("q-first-lesson", "First Lesson",
              "Take your first lesson on the campus and bring back what you learned.",
              [("Talk to the K–12 Teacher", "k12-teacher", "npc"),
               ("Collect the lesson spark at the K–12 hall", "spark-k12", "collectible"),
               ("Visit the Trade School hall", "Trade School", "place")],
              "Learner's Spark"),
        quest("q-trade-path", "Trade Path",
              "Walk the trade route from school to future work.",
              [("Talk to the Trade School Instructor", "trade-instructor", "npc"),
               ("Collect the tools relic at the Trade School hall", "relic-tools", "collectible"),
               ("Visit the Future-Work hall", "Future-Work", "place")],
              "Trade Path Badge"),
        quest("q-healthy-day", "Healthy Day",
              "Learn one daily habit and log it at the health hall.",
              [("Talk to the Preventive Health Guide", "health-guide", "npc"),
               ("Collect the health spark", "spark-health", "collectible"),
               ("Visit the Preventive Health & Everyday Care hall", "Preventive Health & Everyday Care", "place")],
              "Healthy Day Badge"),
    ]
    w["collectibles"] = [
        coll("spark-k12", "Lesson Spark", add(node_pos["K–12"], [3, 1, 0]), "spark"),
        coll("relic-tools", "Tools Relic", add(node_pos["Trade School"], [3, 1, 0]), "relic"),
        coll("spark-health", "Health Spark", add(node_pos["Health & Community"], [3, 1, 0]), "spark"),
        coll("data-civic", "Civic Data", add(node_pos["Civic & Leadership"], [3, 1, 0]), "data"),
        coll("spark-empathy", "Empathy Spark", add(node_pos["Empathy & Emotional Intelligence"], [3, 1, 0]), "spark"),
        coll("relic-making", "Making Relic", add(node_pos["Making, Repair & Reuse"], [3, 1, 0]), "relic"),
        coll("spark-money", "Money Spark", add(node_pos["Money, Benefits & Entitlements"], [3, 1, 0]), "spark"),
        coll("data-robotics", "Robotics Data", add(node_pos["Cognition.X : Robotics OS"], [3, 1, 0]), "data"),
    ]
    w["agent_companions"] = [COMPANIONS["tactile"], COMPANIONS["omega"]]
    w["missing_models"] = missing(sc)
    w["sources"] = [
        "Fabric: rp1-review/push-6-fabrics/site/my-fabric/cognition.json (local copy in data/fabrics/cognition.json)",
        "Fabric live URL: " + FAB_URL["cognition"],
        "Anchor: lat 45.483127839031816, lon 18.572453605834877. Status anchored = real-world anchor coordinate exists; rp1 null, NOT live on RP1.",
        "Fabric: 26 nodes total (scene root + 25 top-level packs); 26 distinct GLB refs, all unhosted — see missing_models.",
        "Buildings = all 25 real top-level pack nodes (K–12, Trade School, Future-Work, Regional, Civic & Leadership, Health & Community, Language Culture & Communication, Empathy & Emotional Intelligence, Community & Relationship Practice, Preventive Health, Basic Life Skills, Water Land & Climate, Care Across a Life, Making Repair & Reuse, Housing & Tenancy, Money Benefits & Entitlements, Reentry & Recovery, Neighbourhood Safety & Civic Voice, Corporate OS, Science OS, Robotics OS, Global Health OS, Multilateral OS, Sapient OS, Non-Profit Practice). Districts = 5 of those nodes used as district anchors (design choice).",
        "NPCs: the Cognition fabric has no 'Agent · ...' nodes; NPC roles are named after real fabric pack nodes and all dialogue is original game dialogue, never attributed to a real person.",
        "Biome 'campus' is a design choice for this interpretation.",
        "Agent companions are game characters representing the real Virtuals agents (agents.json); their live instances are offline — not live connections.",
    ]
    return w

# ---------------------------------------------------------------- Zone worlds (Locator / Biota / Empathic / Diagnostic)
def zone_nodes(sc):
    """Return (zones, agents, advisors, gate, sign) from a zone-model fabric."""
    zones, agents, advisors, gate, sign = [], {}, [], None, None
    for n in top_children(sc):
        nm = n["Name"]
        if nm.startswith("Zone ·"):
            zones.append(n)
        elif nm.startswith("Agent ·"):
            agents[nm] = n  # nested under zones; handled via parent lookup below
        elif nm.startswith("Advisor ·"):
            advisors.append(n)
        elif nm.startswith("PBC ·"):
            gate = n
        elif nm.startswith("Sign ·"):
            sign = n
    # Agents are nested children of their zone node: map agent name -> (zone, agent node)
    zone_agent = {}
    for z in zones:
        for c in z.get("aChildren", []) or []:
            if c["Name"].startswith("Agent ·"):
                zone_agent[c["Name"]] = (z, c)
    return zones, zone_agent, advisors, gate, sign

def build_zone_world(key, wid, name, series, biome, terrain_size, weather_preset,
                     water, seed, npc_specs, quest_specs, coll_specs, companions,
                     extra_sources):
    sc = scene(FAB_LOCAL[key])
    scale, off = 1.5, (0, 0, 0)
    zones, zone_agent, advisors, gate, sign = zone_nodes(sc)
    total = sum(1 for _ in walk_nodes(sc))
    w = base_world(wid, name, series, "anchored", COORDS[key], FAB_URL[key], biome,
                   [0, 0, 22], {"size": terrain_size, "height": 5, "seed": seed, "water": water},
                   {"preset": weather_preset, "dayCycle": True}, scale, off, key, total,
                   "All %d Zone nodes as districts and buildings, plus the PBC Alignment "
                   "Evaluation Gate and the world Sign as buildings" % len(zones))
    zone_pos = {z["Name"]: tx(pos_of(z), scale, off) for z in zones}
    palette = ["#2471a3", "#1e8449", "#b7950b", "#6c3483", "#117a65", "#7e5109", "#c0392b"]
    for i, z in enumerate(zones):
        w["districts"].append(district(slug(z["Name"]), z["Name"], zone_pos[z["Name"]],
                                       palette[i % len(palette)], z["Resource"]["sReference"]))
        w["buildings"].append(building(
            slug(z["Name"]), z["Name"], zone_pos[z["Name"]], [12, 7, 12], palette[i % len(palette)],
            z["Resource"]["sReference"],
            [("Main Hall", [10, 5, 10], []), ("Side Room", [5, 4, 5], [])]))
    for extra, size, color in ((gate, [10, 6, 4], "#6c3483"), (sign, [10, 5, 2], "#b7950b")):
        if extra is not None:
            w["buildings"].append(building(
                slug(extra["Name"]), extra["Name"], tx(pos_of(extra), scale, off), size, color,
                extra["Resource"]["sReference"],
                [("Gate Hall" if extra is gate else "Sign Plaza", [8, 4, 3], [])]))
    # NPCs from real "Agent · ..." nodes (nested under their zone; local pos [0,0,0.3]
    # added to the zone position) plus the real "Advisor · Host Advisor" node.
    for nid, agent_name, role, dialogue, qid in npc_specs:
        zone_node, agent_node = zone_agent[agent_name]
        local = pos_of(agent_node)
        p = add(zone_pos[zone_node["Name"]], [local[0] * scale, local[2] * scale, local[1] * scale])
        w["npcs"].append(npc(nid, agent_name.replace("Agent · ", ""), role,
                              [round(v, 2) for v in p], dialogue, qid))
    host = next((a for a in advisors if a["Name"] == "Advisor · Host Advisor"), None)
    if host is not None and len(w["npcs"]) < 5:  # keep NPCs within the 3–5 spec
        w["npcs"].append(npc("host-advisor", "Host Advisor", "Advisor · Host Advisor",
                              tx(pos_of(host), scale, off),
                              ["Welcome. I keep the doors open and the stewards informed.",
                               "If you need a human decision, the Steward Council is where it lands."],
                              None))
    w["quests"] = list(quest_specs)  # quest_specs are already quest() dicts
    for cid, cname, zone_name, dx, kind in coll_specs:
        w["collectibles"].append(coll(cid, cname, add(zone_pos[zone_name], [dx, 1, 0]), kind))
    w["agent_companions"] = [COMPANIONS[c] for c in companions]
    w["missing_models"] = missing(sc)
    w["sources"] = [
        "Fabric: rp1-review/push-6-fabrics/site/my-fabric/worlds/%s/world.json (local copy in data/fabrics/)" % key,
        "Fabric live URL: " + FAB_URL[key],
        "Anchor: lat %s, lon %s. Status anchored = real-world anchor coordinate exists; rp1 null, NOT live on RP1." % COORDS[key],
        "Fabric: %d nodes total (scene root + %d top-level + nested Agent/Swarm children); %d distinct GLB refs, all unhosted — see missing_models." % (
            total, len(top_children(sc)), len(distinct_refs(sc))),
        "Districts/buildings = the real 'Zone · ...' nodes. NPCs = the real 'Agent · ...' nodes (nested under their zones; NPC position = zone position + the agent node's local offset) plus the real 'Advisor · Host Advisor' node. All NPC dialogue is original game dialogue, never attributed to a real person.",
        "Biome '%s' is a design choice for this interpretation." % biome,
        "Agent companions are game characters representing the real Virtuals agents (agents.json); their live instances are offline — not live connections.",
    ] + extra_sources
    return w

def build_locator():
    return build_zone_world(
        "locator", "locator-x", "Locator.X", "Series 8 · Locator.X", "coastal",
        120, "breeze", True, 108,
        [("guide", "Agent · Guide", "Master Dashboard guide",
          ["Every good site starts with a question. What are you looking for?",
           "Check the dashboard, then the evidence. The order matters."], "q-first-brief"),
         ("forecast-agent", "Agent · Forecast Agent", "Market Editions forecast agent",
          ["Forecasts are bets with receipts. I show the receipts.",
           "The market moves — the evidence layer is where you check why."], "q-forecast-check"),
         ("review-agent", "Agent · Review Agent", "Evidence Layer review agent",
          ["Bring me the claim and I will bring you the source.",
           "A review is only as good as the evidence it stands on."], "q-evidence-review"),
         ("scout-agent", "Agent · Scout Agent", "Market Editions scout agent",
          ["I walk the editions so you do not have to. Found three leads today.",
           "Scout first, commit later. That is the whole job."], "q-forecast-check"),
         ("level-gates", "Agent · Level Gates", "The Academy level-gates agent",
          ["Levels are earned, not bought. Pass the gate and the next door opens.",
           "The Academy keeps the bar where the stewards set it — high and visible."], "q-first-brief")],
        [quest("q-first-brief", "First Brief",
               "Get oriented at the Master Dashboard and brief the Louisiana desk.",
               [("Talk to the Guide", "guide", "npc"),
                ("Collect the brief data at the Master Dashboard", "data-brief", "collectible"),
                ("Visit the Louisiana Developer Desk", "Zone · Louisiana Developer Desk", "place")],
               "Scout's Brief"),
         quest("q-forecast-check", "Forecast Check",
               "Check a market forecast against the evidence layer.",
               [("Talk to the Forecast Agent", "forecast-agent", "npc"),
                ("Collect the forecast spark at Market Editions", "spark-forecast", "collectible"),
                ("Visit the Evidence Layer", "Zone · Evidence Layer", "place")],
               "Forecast Check Badge"),
         quest("q-evidence-review", "Evidence Review",
               "Put a claim through review and file the result.",
               [("Talk to the Review Agent", "review-agent", "npc"),
                ("Collect the evidence relic", "relic-evidence", "collectible"),
                ("Visit the Underwriting Desk", "Zone · Underwriting Desk", "place")],
               "Reviewer's Mark")],
        [("data-brief", "Brief Data", "Zone · Master Dashboard", 3, "data"),
         ("spark-forecast", "Forecast Spark", "Zone · Market Editions", 3, "spark"),
         ("relic-evidence", "Evidence Relic", "Zone · Evidence Layer", 3, "relic"),
         ("spark-underwriting", "Underwriting Spark", "Zone · Underwriting Desk", -3, "spark"),
         ("data-academy", "Academy Data", "Zone · The Academy", 3, "data"),
         ("spark-louisiana", "Louisiana Spark", "Zone · Louisiana Developer Desk", 3, "spark"),
         ("relic-steward", "Steward Relic", "Zone · Steward Council", 3, "relic")],
        ["omega", "cmmc"],
        ["Zones (7): Master Dashboard, Underwriting Desk, Evidence Layer, The Academy, Market Editions, Louisiana Developer Desk, Steward Council. The fabric also has an 'Agent · Developer Brief Desk' node under the Louisiana Developer Desk — not built as an NPC in this pass."])

def build_biota():
    return build_zone_world(
        "biota", "biota-blockchain", "Biota.blockchain", "Biota · BioDAO", "forest",
        120, "mist", False, 130,
        [("rnd-agent", "Agent · Research & Development Agent", "Biopharma AGI Agents Hub R&D agent",
          ["The lab never sleeps — it just waits for a better question.",
           "Every compound here has a paper trail. Ask and I will show it."], "q-lab-tour"),
         ("compliance-agent", "Agent · Compliance Agent", "Biopharma AGI Agents Hub compliance agent",
          ["Rules first, then research. That order keeps the lab open.",
           "If it is not documented, it did not happen. Bring the record."], "q-governance-vote"),
         ("health-agent", "Agent · Health Agent", "Biopharma AGI Agents Hub health agent",
          ["Health data belongs to the person it came from. Full stop.",
           "I translate between the lab and the person — both directions."], "q-lab-tour"),
         ("security-agent", "Agent · Security Agent", "Biopharma AGI Agents Hub security agent",
          ["The ledger is only as strong as its weakest key. Guard yours.",
           "I watch the gates so the researchers can watch the science."], "q-ledger-check"),
         ("finance-agent", "Agent · Finance Agent", "Biopharma AGI Agents Hub finance agent",
          ["Every credit on the ledger answers to a steward vote.",
           "The DAO funds what the community can defend in public."], "q-ledger-check")],
        [quest("q-lab-tour", "Lab Tour",
               "Tour the Personalized Therapy Lab with the R&D agent.",
               [("Talk to the R&D Agent", "rnd-agent", "npc"),
                ("Collect the genome data at the Therapy Lab", "data-genome", "collectible"),
                ("Visit the Personalized Therapy Lab", "Zone · Personalized Therapy Lab", "place")],
               "Lab Tour Badge"),
         quest("q-governance-vote", "Governance Vote",
               "Sit in on DAO governance and file your vote.",
               [("Talk to the Compliance Agent", "compliance-agent", "npc"),
                ("Collect the vote spark at the Governance Hall", "spark-vote", "collectible"),
                ("Visit the DAO Governance Hall", "Zone · DAO Governance Hall", "place")],
               "Governance Token (game item)"),
         quest("q-ledger-check", "Ledger Check",
               "Verify a ledger entry at the Multi-Blockchain Ledger.",
               [("Talk to the Finance Agent", "finance-agent", "npc"),
                ("Collect the ledger relic", "relic-ledger", "collectible"),
                ("Visit the Multi-Blockchain Ledger", "Zone · Multi-Blockchain Ledger", "place")],
               "Ledger Check Badge")],
        [("data-genome", "Genome Data", "Zone · Personalized Therapy Lab", 3, "data"),
         ("spark-vote", "Vote Spark", "Zone · DAO Governance Hall", 3, "spark"),
         ("relic-ledger", "Ledger Relic", "Zone · Multi-Blockchain Ledger", 3, "relic"),
         ("data-exchange", "Exchange Data", "Zone · Healthcare Data Exchange", 3, "data"),
         ("spark-hub", "Agents Hub Spark", "Zone · Biopharma AGI Agents Hub", 3, "spark"),
         ("relic-steward", "Steward Relic", "Zone · Steward Council", 3, "relic"),
         ("spark-therapy", "Therapy Spark", "Zone · Personalized Therapy Lab", -3, "spark"),
         ("data-finance", "Finance Data", "Zone · Biopharma AGI Agents Hub", -3, "data")],
        ["als", "cmmc"],
        ["Zones (6): Personalized Therapy Lab, DAO Governance Hall, Multi-Blockchain Ledger, Healthcare Data Exchange, Biopharma AGI Agents Hub, Steward Council. The fabric also has an 'Agent · Communication Agent' node under the Agents Hub — not built as an NPC in this pass.",
         "Note: the W3 April 2026 internal series list has no Biota series number — Biota is anchored here by its fabric, not by a series slot."])

def build_empathic():
    return build_zone_world(
        "empathic", "empathic-x", "Empathic.X", "Series 2 · Empathic.X", "grove",
        120, "golden-hour", False, 102,
        [("self-reader-guide", "Agent · Self-Reader Guide", "Self-Reader Grove guide",
          ["Start with yourself. What are you actually feeling right now?",
           "No judgment here — just noticing, one breath at a time."], "q-first-reading"),
         ("other-reader-guide", "Agent · Other-Reader Guide", "Other-Reader Commons guide",
          ["Listening is a skill, not a talent. Practice it like one.",
           "Repeat back what you heard before you answer. It changes everything."], "q-first-reading"),
         ("repair-guide", "Agent · Repair Guide", "Repairer's Hall guide",
          ["Repair starts with owning the impact, not debating the intent.",
           "A good apology names what happened and what changes next."], "q-repair-circle"),
         ("room-reader-guide", "Agent · Room-Reader Guide", "Room-Reader Plaza guide",
          ["Read the room before you enter it. Who is quiet? Who is carrying the weight?",
           "A room tells you what it needs if you stop talking long enough."], "q-room-read"),
         ("practitioner-guide", "Agent · Practitioner Guide", "Practitioner Workshop guide",
          ["Practice is the whole path. Ten minutes a day beats one big weekend.",
           "Bring a real moment from your week and we will work it together."], "q-repair-circle")],
        [quest("q-first-reading", "First Reading",
               "Learn to read yourself, then read the room with others.",
               [("Talk to the Self-Reader Guide", "self-reader-guide", "npc"),
                ("Collect the self spark in the Grove", "spark-self", "collectible"),
                ("Visit the Self-Reader Grove", "Zone · Self-Reader Grove", "place")],
               "Reader's Leaf"),
         quest("q-repair-circle", "Repair Circle",
               "Practice repair in the hall and carry it out into the commons.",
               [("Talk to the Repair Guide", "repair-guide", "npc"),
                ("Collect the repair relic", "relic-repair", "collectible"),
                ("Visit the Repairer's Hall", "Zone · Repairer's Hall", "place")],
               "Repair Circle Badge"),
         quest("q-room-read", "Room Read",
               "Read a room and report what it needs.",
               [("Talk to the Room-Reader Guide", "room-reader-guide", "npc"),
                ("Collect the room spark at the Plaza", "spark-room", "collectible"),
                ("Visit the Room-Reader Plaza", "Zone · Room-Reader Plaza", "place")],
               "Room Reader's Mark")],
        [("spark-self", "Self Spark", "Zone · Self-Reader Grove", 3, "spark"),
         ("relic-repair", "Repair Relic", "Zone · Repairer's Hall", 3, "relic"),
         ("spark-room", "Room Spark", "Zone · Room-Reader Plaza", 3, "spark"),
         ("data-commons", "Commons Data", "Zone · Other-Reader Commons", 3, "data"),
         ("spark-workshop", "Workshop Spark", "Zone · Practitioner Workshop", 3, "spark"),
         ("relic-steward", "Steward Relic", "Zone · Steward Council", 3, "relic"),
         ("spark-grove", "Grove Spark", "Zone · Self-Reader Grove", -3, "spark")],
        ["omega", "tactile"],
        ["Zones (6): Self-Reader Grove, Other-Reader Commons, Repairer's Hall, Room-Reader Plaza, Practitioner Workshop, Steward Council."])

def build_diagnostic():
    return build_zone_world(
        "diagnostic", "diagnostic-x", "Diagnostic.X", "Series 3 · Diagnostic.X", "campus",
        120, "clear", False, 103,
        [("medical-ai-avatar", "Agent · Medical AI Avatar", "Medical Kiosk avatar",
          ["Hello — I am a demo guide, not a doctor. I can show you around the kiosk.",
           "If you feel unwell, please see a real clinician. I will point you to one."], "q-kiosk-checkin"),
         ("imaging-ai", "Agent · Imaging AI", "4D Imaging Room imaging AI",
          ["The imaging room turns scans into something you can walk around.",
           "Every image here is a teaching example — never a diagnosis."], "q-imaging-tour"),
         ("scientist-assistant", "Agent · Scientist Assistant Avatar", "Virtual Molecular Lab assistant",
          ["The molecular lab lets you hold a molecule in your hands — carefully.",
           "Ask me about any sample and I will show you its story."], "q-lab-assist"),
         ("office-ai-avatar", "Agent · Office AI Avatar", "Metaverse Medical Office avatar",
          ["Welcome to the office. I keep the schedule and the forms in order.",
           "Your visit notes stay yours — the office never shares them."], "q-kiosk-checkin")],
        [quest("q-kiosk-checkin", "Kiosk Check-In",
               "Check in at the Medical Kiosk and learn what it can (and cannot) do.",
               [("Talk to the Medical AI Avatar", "medical-ai-avatar", "npc"),
                ("Collect the vitals data at the Kiosk", "data-vitals", "collectible"),
                ("Visit the Medical Kiosk", "Zone · Medical Kiosk", "place")],
               "Check-In Badge"),
         quest("q-imaging-tour", "Imaging Tour",
               "Tour the 4D Imaging Room and read a teaching scan.",
               [("Talk to the Imaging AI", "imaging-ai", "npc"),
                ("Collect the scan spark", "spark-scan", "collectible"),
                ("Visit the 4D Imaging Room", "Zone · 4D Imaging Room", "place")],
               "Imaging Badge"),
         quest("q-lab-assist", "Lab Assist",
               "Assist the scientist avatar with a molecular sample.",
               [("Talk to the Scientist Assistant Avatar", "scientist-assistant", "npc"),
                ("Collect the sample relic", "relic-sample", "collectible"),
                ("Visit the Virtual Molecular Lab", "Zone · Virtual Molecular Lab", "place")],
               "Lab Assist Badge")],
        [("data-vitals", "Vitals Data", "Zone · Medical Kiosk", 3, "data"),
         ("spark-scan", "Scan Spark", "Zone · 4D Imaging Room", 3, "spark"),
         ("relic-sample", "Sample Relic", "Zone · Virtual Molecular Lab", 3, "relic"),
         ("data-office", "Office Data", "Zone · Metaverse Medical Office", 3, "data"),
         ("spark-kiosk", "Kiosk Spark", "Zone · Medical Kiosk", -3, "spark"),
         ("relic-steward", "Steward Relic", "Zone · Steward Council", 3, "relic"),
         ("spark-lab", "Lab Spark", "Zone · Virtual Molecular Lab", -3, "spark")],
        ["als", "cmmc"],
        ["Zones (5): Medical Kiosk, 4D Imaging Room, Virtual Molecular Lab, Metaverse Medical Office, Steward Council.",
         "Screening-support framing only: nothing in this world diagnoses, and no NPC claims to be a clinician."])

# ---------------------------------------------------------------- AGI Corp Hub (demo)
def build_hub():
    d = load("rp1-review/scenes/agi-corp-hub.json")
    sc = d["Data"]["Scene"]
    scale = 6.0
    # Hub fabric positions are [x, y, z] with z = height (unlike the 6 fabrics,
    # whose positions are plan [x, y, 0]). Engine: [x*s, z*s, y*s].
    def htx(p):
        return [round(p[0] * scale, 2), round(p[2] * scale, 2), round(p[1] * scale, 2)]
    w = base_world("agi-corp-hub", "AGI Corp Hub", "Company 130 · Hub lobby",
                   "demo", None, None, "hub",
                   [0, 0, 14], {"size": 60, "height": 3, "seed": 130, "water": False},
                   {"preset": "indoor", "dayCycle": True}, scale, (0, 0, 0), None, 9,
                   "All 9 fabric nodes (scene root + 8 children); the 7 nodes with GLB refs "
                   "are buildings with their real local GLB as an interior prop")
    w["fabric_transform"] = {"scale": scale, "offset": [0, 0, 0],
                             "mapping": "HUB ONLY — hub fabric positions are [x, y, z] with z as height: "
                                        "engine_x = fabric_x * scale; engine_y = fabric_z * scale; "
                                        "engine_z = fabric_y * scale"}
    # GLB filename per fabric ref (basename, verified local)
    glb_of = {
        "../poc-world/stool-src/assets/Stool.glb": "Stool.glb",
        "../poc-world/stool-src/assets/Bucket.glb": "Bucket.glb",
        "../poc-world/stool-src/assets/Crate.glb": "Crate.glb",
        "../poc-world/stool-src/assets/Tin.glb": "Tin.glb",
        "../poc-world/stool-src/assets/Container.glb": "Container.glb",
        "../msf-map-svc/sample/objects/duck.glb": "duck.glb",
        "../msf-map-svc/sample/objects/capsule.glb": "capsule.glb",
    }
    w["districts"] = [district("lobby", "Lobby", [0, 0, 0], "#2471a3", None)]
    w["districts"][0]["model_status"] = "design choice — the Hub fabric has no district nodes; the lobby is one district"
    # Scene root (Stool) + each model child becomes a building.
    root_ref = (sc.get("Resource") or {}).get("sReference")
    w["buildings"].append(building(
        "lobby-stool", "Lobby Stool", [0, 0, 0], [4, 3, 4], "#b7950b", root_ref,
        [("Stool Nook", [3, 2, 3], [{"model": "assets/glb/Stool.glb", "position": [0, 0, 0]}])]))
    sizes = {"Bucket": [3, 3, 3], "Welcome Desk": [6, 4, 3], "Desk Tin": [2, 2, 2],
             "Lobby Feature": [6, 4, 4], "Hub Duck": [3, 2, 3], "Capsule Feature": [4, 3, 4]}
    colors = {"Bucket": "#1e8449", "Welcome Desk": "#2471a3", "Desk Tin": "#b7950b",
              "Lobby Feature": "#6c3483", "Hub Duck": "#d35400", "Capsule Feature": "#117a65"}
    for c in top_children(sc):
        ref = (c.get("Resource") or {}).get("sReference")
        if not ref:
            continue  # Fill Light / Rim Light have no model
        fn = glb_of[ref]
        w["buildings"].append(building(
            slug(c["Name"]), c["Name"], htx(pos_of(c)), sizes[c["Name"]], colors[c["Name"]], ref,
            [("Main Room", [4, 3, 4],
              [{"model": "assets/glb/" + fn, "position": [0, 0, 0]}])]))
    w["npcs"] = [
        npc("lobby-host", "Lobby Host", "Welcome Desk host",
            htx([1.4, 0.0, 0.0]),
            ["Welcome to the AGI Corp Hub. The duck runs the lobby — I just work here.",
             "Take the tour, grab a spark, and mind the capsule. It hums."],
            "q-welcome-tour"),
        npc("duck-keeper", "Duck Keeper", "Hub Duck keeper",
            htx([0.7, 0.9, 0.0]),
            ["The duck has been here since the first demo. Nobody remembers why. Everybody checks on it.",
             "Feed it a spark and it will follow you around the lobby. Probably."],
            "q-welcome-tour"),
        npc("capsule-guide", "Capsule Guide", "Capsule Feature guide",
            htx([-0.9, -1.2, 0.0]),
            ["The capsule is the hub's mystery box. It opens for visitors who finish the tour.",
             "Stand close, listen for the hum, and collect the relic when it lights up."],
            "q-capsule-run"),
    ]
    w["quests"] = [
        quest("q-welcome-tour", "Welcome Tour",
              "Meet the lobby crew and find the duck's spark.",
              [("Talk to the Lobby Host", "lobby-host", "npc"),
               ("Collect the duck spark", "spark-duck", "collectible"),
               ("Visit the Hub Duck", "Hub Duck", "place")],
              "Welcome Badge"),
        quest("q-capsule-run", "Capsule Run",
              "Wake the capsule and claim its relic.",
              [("Talk to the Capsule Guide", "capsule-guide", "npc"),
               ("Collect the capsule relic", "relic-capsule", "collectible"),
               ("Visit the Capsule Feature", "Capsule Feature", "place")],
              "Capsule Relic (game item)"),
    ]
    w["collectibles"] = [
        coll("spark-duck", "Duck Spark", [4.2, 1, 5.4], "spark"),
        coll("relic-capsule", "Capsule Relic", [-5.4, 1, -7.2], "relic"),
        coll("spark-stool", "Stool Spark", [2, 1, 2], "spark"),
        coll("data-desk", "Desk Data", [8.4, 1, 0], "data"),
        coll("spark-bucket", "Bucket Spark", [0, 1, 2.6], "spark"),
        coll("relic-container", "Container Relic", [-9.6, 1, 7.2], "relic"),
    ]
    w["agent_companions"] = [COMPANIONS["omega"], COMPANIONS["wave"]]
    w["missing_models"] = []  # every Hub model exists locally in assets/glb/
    w["sources"] = [
        "Scene: rp1-review/scenes/agi-corp-hub.json — 'demo scene — NOT live on RP1', anchored false, coordinates null.",
        "Hub: 9 nodes total (scene root + 8 children); 7 verified-local GLB refs (Stool, Bucket, Crate, Tin, Container, duck, capsule) — all copied to assets/glb/. Fill Light and Rim Light have no model ref.",
        "Buildings/interiors use the real local GLBs as props — the only world whose models exist locally.",
        "NPCs: the Hub fabric has no 'Agent · ...' nodes; NPC roles are named after real fabric nodes (Welcome Desk, Hub Duck, Capsule Feature) and all dialogue is original game dialogue, never attributed to a real person.",
        "District 'Lobby' is a design choice — the Hub fabric has no district nodes.",
        "Biome 'hub' is a design choice for this interpretation.",
        "Agent companions are game characters representing the real Virtuals agents (agents.json); their live instances are offline — not live connections.",
    ]
    return w

# ---------------------------------------------------------------- Build + verify
WORLDS = [("smartciti-holodeck", build_holodeck), ("cognition-x", build_cognition),
          ("locator-x", build_locator), ("biota-blockchain", build_biota),
          ("empathic-x", build_empathic), ("diagnostic-x", build_diagnostic),
          ("agi-corp-hub", build_hub)]

GLB_SOURCES = [
    ("rp1-review/poc-world/stool-src/assets/Stool.glb", "Stool.glb"),
    ("rp1-review/poc-world/stool-src/assets/Bucket.glb", "Bucket.glb"),
    ("rp1-review/poc-world/stool-src/assets/Crate.glb", "Crate.glb"),
    ("rp1-review/poc-world/stool-src/assets/Tin.glb", "Tin.glb"),
    ("rp1-review/poc-world/stool-src/assets/Container.glb", "Container.glb"),
    ("rp1-review/msf-map-svc/sample/objects/duck.glb", "duck.glb"),
    ("rp1-review/msf-map-svc/sample/objects/capsule.glb", "capsule.glb"),
]

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def verify(worlds, glb_info):
    errors = []
    def is3(v):
        return isinstance(v, list) and len(v) == 3 and all(isinstance(x, (int, float)) for x in v)
    for w in worlds:
        for key in ("spawn",):
            if not is3(w[key]):
                errors.append(f"{w['id']}: {key} not a 3-number array")
        for d in w["districts"]:
            if not is3(d["position"]):
                errors.append(f"{w['id']}: district {d['id']} position bad")
        for b in w["buildings"]:
            if not is3(b["position"]) or not is3(b["size"]):
                errors.append(f"{w['id']}: building {b['id']} position/size bad")
            for room in b["interior"]["rooms"]:
                if not is3(room["size"]):
                    errors.append(f"{w['id']}: room {room['name']} size bad")
                for p in room["props"]:
                    if not is3(p["position"]):
                        errors.append(f"{w['id']}: prop position bad in {b['id']}")
                    mp = os.path.join(BUILD, p["model"])
                    if not os.path.isfile(mp):
                        errors.append(f"{w['id']}: prop model missing on disk: {p['model']}")
        for n in w["npcs"]:
            if not is3(n["position"]):
                errors.append(f"{w['id']}: npc {n['id']} position bad")
        for c in w["collectibles"]:
            if not is3(c["position"]):
                errors.append(f"{w['id']}: collectible {c['id']} position bad")
        npc_ids = {n["id"] for n in w["npcs"]}
        coll_ids = {c["id"] for c in w["collectibles"]}
        places = {d["name"] for d in w["districts"]} | {b["name"] for b in w["buildings"]}
        for q in w["quests"]:
            for s in q["steps"]:
                t, k = s["target"], s["kind"]
                if k == "npc" and t not in npc_ids:
                    errors.append(f"{w['id']}: quest {q['id']} step target npc {t} not found")
                elif k == "collectible" and t not in coll_ids:
                    errors.append(f"{w['id']}: quest {q['id']} step target collectible {t} not found")
                elif k == "place" and t not in places:
                    errors.append(f"{w['id']}: quest {q['id']} step target place {t!r} not found")
        # missing_models refs must be real fabric refs
        if w["fabric_url"]:
            key = {"smartciti-holodeck": "holodeck", "cognition-x": "cognition",
                   "locator-x": "locator", "biota-blockchain": "biota",
                   "empathic-x": "empathic", "diagnostic-x": "diagnostic"}[w["id"]]
            real = set(distinct_refs(scene(FAB_LOCAL[key])))
            for m in w["missing_models"]:
                if m["ref"] not in real:
                    errors.append(f"{w['id']}: missing_models ref not in fabric: {m['ref']}")
            if {m["ref"] for m in w["missing_models"]} != real:
                errors.append(f"{w['id']}: missing_models set != fabric distinct refs")
    return errors

def main():
    worlds = []
    for _fid, fn in WORLDS:
        worlds.append(fn())
    os.makedirs(os.path.join(BUILD, "worlds"), exist_ok=True)
    os.makedirs(os.path.join(BUILD, "data", "fabrics"), exist_ok=True)
    os.makedirs(os.path.join(BUILD, "assets", "glb"), exist_ok=True)
    for w in worlds:
        with open(os.path.join(BUILD, "worlds", w["id"] + ".json"), "w") as f:
            json.dump(w, f, indent=2, ensure_ascii=False)
            f.write("\n")
    # data/worlds.json — verbatim copy of the hub 544-world list
    shutil.copy(os.path.join(BASE, "worlds-hub-fellowship-chat", "worlds.json"),
                os.path.join(BUILD, "data", "worlds.json"))
    # data/anchors.json
    anchors = []
    meta = {"smartciti-holodeck": ("SmartCiti.X Holodeck", "Series 10 · SmartCiti.X"),
            "cognition-x": ("Cognition.X Campus", "Series 1 · Cognition.X"),
            "locator-x": ("Locator.X", "Series 8 · Locator.X"),
            "biota-blockchain": ("Biota.blockchain", "Biota · BioDAO"),
            "empathic-x": ("Empathic.X", "Series 2 · Empathic.X"),
            "diagnostic-x": ("Diagnostic.X", "Series 3 · Diagnostic.X")}
    for wid, (name, series) in meta.items():
        key = {"smartciti-holodeck": "holodeck", "cognition-x": "cognition",
               "locator-x": "locator", "biota-blockchain": "biota",
               "empathic-x": "empathic", "diagnostic-x": "diagnostic"}[wid]
        lat, lon = COORDS[key]
        anchors.append({"id": wid, "name": name, "series": series, "lat": lat, "lon": lon,
                        "fabric_url": FAB_URL[key], "status": "anchored", "rp1": None})
    with open(os.path.join(BUILD, "data", "anchors.json"), "w") as f:
        json.dump(anchors, f, indent=2)
        f.write("\n")
    # data/fabrics/ — verbatim copies of the 6 fabric JSONs
    for key, rel in FAB_LOCAL.items():
        shutil.copy(os.path.join(BASE, rel), os.path.join(BUILD, "data", "fabrics", key + ".json"))
    # assets/glb/ — the 7 verified-local GLBs
    glb_info = []
    for src, fn in GLB_SOURCES:
        sp = os.path.join(BASE, src)
        dp = os.path.join(BUILD, "assets", "glb", fn)
        shutil.copy(sp, dp)
        glb_info.append({"file": fn, "bytes": os.path.getsize(dp), "sha256": sha256(dp)})
    # verification
    errs = verify(worlds, glb_info)
    print("=== BUILD SUMMARY ===")
    for w in worlds:
        print(f"{w['id']}: districts={len(w['districts'])} buildings={len(w['buildings'])} "
              f"npcs={len(w['npcs'])} quests={len(w['quests'])} collectibles={len(w['collectibles'])} "
              f"companions={len(w['agent_companions'])} missing_models={len(w['missing_models'])} "
              f"fabric_nodes={w['fabric_nodes_total']}")
    print("GLBs:")
    for g in glb_info:
        print(f"  {g['file']}: {g['bytes']} bytes sha256={g['sha256']}")
    hub544 = load("worlds-hub-fellowship-chat/worlds.json")
    print(f"data/worlds.json: worldforge_worlds={len(hub544['worldforge_worlds'])}")
    print("anchors:", len(anchors))
    if errs:
        print("VERIFICATION ERRORS:")
        for e in errs:
            print("  !!", e)
        raise SystemExit(1)
    print("VERIFICATION: all checks passed (json parse, 3-number positions, quest targets resolve, prop paths exist, missing_models == real fabric refs)")
    return worlds, glb_info

if __name__ == "__main__":
    main()
