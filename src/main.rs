//! ReachMap data pipeline — build Cuba artifacts from LACNIC + RouteViews RIB.
//!
//! Usage:
//!   cargo run -- --lacnic data/snapshots/delegated-lacnic-extended-latest \
//!                --rib data/snapshots/rib.20260528.0000.bz2 \
//!                --out data/processed/countries/CU

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use bgpkit_parser::BgpkitParser;
use serde::{Deserialize, Serialize};
use std::net::IpAddr;

// ── Types ───────────────────────────────────────────────────

/// Geolocation resolution for a viewpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeoResolution {
    kind: String,            // collector_location, peer_ip_geo, manual, asn_headquarters, unknown
    source: String,          // e.g. maxmind-geolite2-city, manual-override
    #[serde(skip_serializing_if = "Option::is_none")]
    source_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_url: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    city: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    region: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    country_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    continent: Option<String>,
    confidence: f64,         // 0..1
    #[serde(skip_serializing_if = "Option::is_none")]
    precision: Option<String>, // exact, city, region, country, unknown
    #[serde(skip_serializing_if = "Option::is_none")]
    note: Option<String>,
}

/// Manual override entry from config/geolocation-overrides.json
#[derive(Debug, Clone, Deserialize)]
struct GeoOverride {
    kind: String,
    #[serde(default)]
    latitude: Option<f64>,
    #[serde(default)]
    longitude: Option<f64>,
    #[serde(default)]
    city: Option<String>,
    #[serde(default)]
    region: Option<String>,
    #[serde(default)]
    country_code: Option<String>,
    #[serde(default)]
    continent: Option<String>,
    confidence: f64,
    #[serde(default)]
    precision: Option<String>,
    #[serde(default)]
    note: Option<String>,
}

// ── Types (continued) ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CountryPrefix {
    prefix: String,
    prefix_start: u32,
    prefix_end: u32,
    prefix_length: u8,
    address_count: u32,
    origin_asns: Vec<u32>,
    origin_names: Vec<String>,
    observed_in_bgp: bool,
    confidence: String,
    rir_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotMetadata {
    source: String,
    collector: String,
    rib_timestamp: String,
    downloaded_at: String,
    mrt_filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ViewpointArtifact {
    id: String,
    collector: String,
    peer_asn: u32,
    peer_as_name: Option<String>,
    peer_ip: Option<String>,
    geo: GeoResolution,
    display_name: String,
    region_group: String,
    visible_prefixes: Vec<String>,
    missing_prefixes: Vec<String>,
    path_family_ids: Vec<String>,
    snapshot: SnapshotMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AsViewArtifact {
    peer_asn: u32,
    peer_as_name: Option<String>,
    viewpoint_ids: Vec<String>,
    visible_prefixes: Vec<String>,
    missing_prefixes: Vec<String>,
    path_family_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PathFamilyArtifact {
    id: String,
    normalized_path: Vec<u32>,
    upstream_asn: u32,
    origin_asn: u32,
    prefixes: Vec<String>,
    collectors: Vec<String>,
    observation_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ViewpointIndex {
    country_code: String,
    generated_ts: String,
    viewpoint_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AsnIndex {
    country_code: String,
    generated_ts: String,
    asns: Vec<u32>,
}

// ── Collector & Consensus Types ─────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CollectorDef {
    id: String,
    name: String,
    source: String, // routeviews | ris
    latitude: f64,
    longitude: f64,
    #[serde(default)]
    city: Option<String>,
    #[serde(default)]
    region: Option<String>,
    #[serde(default)]
    country_code: Option<String>,
    #[serde(default)]
    continent: Option<String>,
    #[serde(default)]
    region_group: Option<String>,
    confidence: f64,
    #[serde(default)]
    multihop_policy: Option<String>,
    #[serde(default)]
    notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CollectorsFile {
    #[serde(default)]
    description: String,
    collectors: HashMap<String, CollectorDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PeerObservationArtifact {
    id: String,
    collector_id: String,
    peer_asn: u32,
    peer_as_name: Option<String>,
    peer_ip: Option<String>,
    peer_locality: String, // "single_hop" | "multihop" | "unknown"
    #[serde(skip_serializing_if = "Option::is_none")]
    locality_evidence: Option<String>,
    included_in_geo_consensus: bool,
    geo_interpretation: String, // "collector_rib" | "local_peer" | "remote_peer" | "unknown"
    visible_prefixes: Vec<String>,
    path_family_ids: Vec<String>,
    snapshot: SnapshotMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CollectorVisibilityArtifact {
    collector_id: String,
    collector_name: String,
    collector_source: String,
    latitude: f64,
    longitude: f64,
    city: Option<String>,
    country_code: Option<String>,
    continent: Option<String>,
    region_group: String,
    confidence: f64,
    peer_observation_ids: Vec<String>,
    visible_prefixes: Vec<String>,
    missing_prefixes: Vec<String>,
    path_family_ids: Vec<String>,
    snapshot: SnapshotMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConsensusVisibilityArtifact {
    scope: String, // "all_collectors" | "region"
    collector_ids: Vec<String>,
    total_collectors: usize,
    visibility_by_prefix: HashMap<String, PrefixVisibilityScore>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrefixVisibilityScore {
    prefix: String,
    observed_collectors: usize,
    total_collectors: usize,
    visibility_ratio: f64,
    observed_collector_ids: Vec<String>,
    missing_collector_ids: Vec<String>,
}

#[derive(Debug, Clone)]
struct LacnicRecord {
    start_address: String,
    address_count: u32,
    status: String,
}

#[derive(Debug, Clone)]
struct RouteObs {
    peer_asn: u32,
    origin_asn: u32,
    prefix: String,
    as_path: Vec<u32>,
}

// ── Constants ───────────────────────────────────────────────

const COUNTRY_CODE: &str = "CU";
const COUNTRY_NAME: &str = "Cuba";

// ── Utility functions ───────────────────────────────────────

fn ip_to_u32(ip: &str) -> Option<u32> {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 { return None; }
    let mut result: u32 = 0;
    for p in parts {
        result = (result << 8) | p.parse::<u32>().ok()?;
    }
    Some(result)
}

fn cidr_from_count(start: &str, count: u32) -> (String, u8) {
    let len = 32 - (32 - count.leading_zeros()) as u8;
    let adjusted = if count.is_power_of_two() { len } else { len.saturating_sub(1) };
    let prefix_len = adjusted.clamp(8, 32);
    (format!("{}/{}", start, prefix_len), prefix_len)
}

fn normalize_path(path: &[u32]) -> Vec<u32> {
    let mut result: Vec<u32> = Vec::new();
    for &asn in path {
        if result.last() != Some(&asn) { result.push(asn); }
    }
    result
}

fn parse_lacnic(data: &str, country: &str) -> Vec<LacnicRecord> {
    let mut records = Vec::new();
    for line in data.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() < 8 { continue; }
        if parts[1] == country && parts[2] == "ipv4" {
            if let Ok(count) = parts[4].parse::<u32>() {
                records.push(LacnicRecord {
                    start_address: parts[3].to_string(),
                    address_count: count,
                    status: parts[6].to_string(),
                });
            }
        }
    }
    records
}

fn path_family_id(path: &[u32]) -> String {
    let segs: Vec<String> = path.iter().map(|a| a.to_string()).collect();
    format!("pf-{}", segs.join("-"))
}

fn parse_prefix_to_range(pfx: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = pfx.split('/').collect();
    if parts.len() != 2 { return None; }
    let ip = ip_to_u32(parts[0])?;
    let bits: u8 = parts[1].parse().ok()?;
    let mask = if bits == 0 { 0u32 } else { !0u32 << (32 - bits) };
    let start = ip & mask;
    let end = start.wrapping_add((1u64 << (32 - bits)) as u32).wrapping_sub(1);
    Some((start, end))
}

// ── Geo Resolution ──────────────────────────────────────────

/// Load manual overrides from a JSON file.
fn load_overrides(path: &std::path::Path) -> Result<HashMap<String, GeoOverride>> {
    let data = fs::read_to_string(path)?;
    let map: HashMap<String, GeoOverride> = serde_json::from_str(&data)?;
    Ok(map)
}

/// Resolve geo for a viewpoint using manual overrides first, then GeoIP, then fallback.
fn resolve_geo(
    collector: &str,
    peer_asn: u32,
    peer_ip: &Option<IpAddr>,
    overrides: &HashMap<String, GeoOverride>,
    geoip_reader: &Option<maxminddb::Reader<Vec<u8>>>,
) -> GeoResolution {
    // 1. Check manual overrides: collector:<name>
    let collector_key = format!("collector:{}", collector);
    if let Some(ov) = overrides.get(&collector_key) {
        return geo_from_override(ov, "manual-override", &collector_key);
    }

    // 2. Check manual overrides: peer:<ASN>
    let asn_key = format!("peer:{}", peer_asn);
    if let Some(ov) = overrides.get(&asn_key) {
        return geo_from_override(ov, "manual-override", &asn_key);
    }

    // 3. Check manual overrides: peerIp:<IP>
    if let Some(ip) = peer_ip {
        let ip_key = format!("peerIp:{}", ip);
        if let Some(ov) = overrides.get(&ip_key) {
            return geo_from_override(ov, "manual-override", &ip_key);
        }

        // 4. GeoIP lookup (maxminddb 0.28 API)
        if let Some(reader) = geoip_reader {
            if let Ok(result) = reader.lookup(*ip) {
                if let Ok(Some(city)) = result.decode::<maxminddb::geoip2::City>() {
                    let city_name = city.city.names.english.map(|s| s.to_string());
                    let lat = city.location.latitude;
                    let lon = city.location.longitude;
                    let country = city.country.iso_code.map(|s| s.to_string());
                    let continent = city.continent.code.map(|s| s.to_string());
                    let region = city.subdivisions.first()
                        .and_then(|s| s.names.english)
                        .map(|s| s.to_string());

                    if lat.is_some() && lon.is_some() {
                        return GeoResolution {
                            kind: "peer_ip_geo".into(),
                            source: "maxmind-geolite2-city".into(),
                            source_version: None,
                            source_url: Some("https://www.maxmind.com/en/geolite2/signup".into()),
                            latitude: lat,
                            longitude: lon,
                            city: city_name,
                            region,
                            country_code: country,
                            continent,
                            confidence: 0.65,
                            precision: Some("city".into()),
                            note: Some("Peer IP geolocation via MaxMind GeoLite2 City. May reflect ISP headquarters, not BGP router.".into()),
                        };
                    }

                    // Country-level fallback
                    if let Some(ref cc) = country {
                        return GeoResolution {
                            kind: "peer_ip_geo".into(),
                            source: "maxmind-geolite2-city".into(),
                            source_version: None,
                            source_url: Some("https://www.maxmind.com/en/geolite2/signup".into()),
                            latitude: None,
                            longitude: None,
                            city: None,
                            region: None,
                            country_code: Some(cc.clone()),
                            continent,
                            confidence: 0.40,
                            precision: Some("country".into()),
                            note: Some("MaxMind GeoLite2 country-level only — no city coordinates available.".into()),
                        };
                    }
                }
            }
        }
    }

    // 5. Unknown
    GeoResolution {
        kind: "unknown".into(),
        source: "none".into(),
        source_version: None,
        source_url: None,
        latitude: None,
        longitude: None,
        city: None,
        region: None,
        country_code: None,
        continent: None,
        confidence: 0.0,
        precision: Some("unknown".into()),
        note: Some("No geolocation data available for this viewpoint.".into()),
    }
}

fn geo_from_override(ov: &GeoOverride, source: &str, _key: &str) -> GeoResolution {
    GeoResolution {
        kind: ov.kind.clone(),
        source: source.into(),
        source_version: None,
        source_url: None,
        latitude: ov.latitude,
        longitude: ov.longitude,
        city: ov.city.clone(),
        region: ov.region.clone(),
        country_code: ov.country_code.clone(),
        continent: ov.continent.clone(),
        confidence: ov.confidence,
        precision: ov.precision.clone(),
        note: ov.note.clone(),
    }
}

/// Assign a region group based on coordinates or country code.
fn assign_region_group(geo: &GeoResolution) -> String {
    if let (Some(lat), Some(lon)) = (geo.latitude, geo.longitude) {
        // North America: roughly 20-75 N, 130-60 W
        if lat > 20.0 && lat < 75.0 && lon > -130.0 && lon < -60.0 {
            return "North America".into();
        }
        // Central America: roughly 8-30 N, 120-60 W (south of Mexico/US)
        if lat > 5.0 && lat < 30.0 && lon > -120.0 && lon < -60.0 {
            if lat < 20.0 { return "Central America".into(); }
        }
        // Caribbean: roughly 10-30 N, 90-60 W (islands)
        if lat > 10.0 && lat < 28.0 && lon > -90.0 && lon < -60.0 {
            return "Caribbean".into();
        }
        // South America: roughly -60 to 15 N, 80-30 W
        if lat > -60.0 && lat < 15.0 && lon > -85.0 && lon < -30.0 {
            return "South America".into();
        }
        // Europe: roughly 35-72 N, 10 W to 60 E
        if lat > 35.0 && lat < 72.0 && lon > -10.0 && lon < 60.0 {
            return "Europe".into();
        }
        // Africa
        if lat > -35.0 && lat < 38.0 && lon > -20.0 && lon < 55.0 {
            return "Africa".into();
        }
        // Asia
        if lat > 0.0 && lon > 60.0 && lon < 180.0 { return "Asia".into(); }
        // Oceania
        if lat < 0.0 && lon > 110.0 && lon < 180.0 { return "Oceania".into(); }
        return "Other".into();
    }

    // Fallback: country code → region
    if let Some(ref cc) = geo.country_code {
        match cc.as_str() {
            "US" | "CA" => return "North America".into(),
            "MX" | "GT" | "HN" | "SV" | "NI" | "CR" | "PA" | "BZ" => return "Central America".into(),
            "CU" | "DO" | "PR" | "JM" | "HT" | "TT" | "BS" | "BB" => return "Caribbean".into(),
            "BR" | "AR" | "CL" | "CO" | "PE" | "VE" | "EC" | "BO" | "PY" | "UY" => return "South America".into(),
            "GB" | "DE" | "FR" | "ES" | "IT" | "NL" | "SE" | "CH" | "AT" | "BE" | "DK" | "FI" | "NO" | "PT" | "IE" | "PL" | "CZ" | "RO" | "GR" | "HU" | "UA" | "RU" => return "Europe".into(),
            "ZA" | "NG" | "KE" | "EG" | "MA" | "TN" | "ET" => return "Africa".into(),
            "JP" | "CN" | "IN" | "KR" | "SG" | "HK" | "TW" | "ID" | "MY" | "TH" | "VN" | "PH" => return "Asia".into(),
            "AU" | "NZ" => return "Oceania".into(),
            _ => return "Other".into(),
        }
    }

    "Unknown".into()
}

// ── Main ────────────────────────────────────────────────────

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let lacnic_path = args.iter().position(|a| a == "--lacnic").map(|i| PathBuf::from(&args[i + 1]));
    let prefix_file = args.iter().position(|a| a == "--prefix-file").map(|i| PathBuf::from(&args[i + 1]));
    // Parse multiple --rib collectorId=path arguments
    let rib_args: Vec<(String, PathBuf)> = {
        let mut ribs = Vec::new();
        let mut i = 0;
        while i < args.len() {
            if args[i] == "--rib" {
                let val = &args[i + 1];
                if let Some(eq_pos) = val.find('=') {
                    let cid = val[..eq_pos].to_string();
                    let path = PathBuf::from(&val[eq_pos + 1..]);
                    ribs.push((cid, path));
                } else {
                    return Err(anyhow::anyhow!("--rib must be in format collectorId=path, got: {}", val));
                }
                i += 2;
            } else {
                i += 1;
            }
        }
        if ribs.is_empty() { return Err(anyhow::anyhow!("Missing --rib collectorId=path (at least one required)")); }
        ribs
    };
    let out_dir = {
        let pos = args.iter().position(|a| a == "--out")
            .context("Missing --out <dir>")?;
        PathBuf::from(&args[pos + 1])
    };
    let snapshot_id = args.iter().position(|a| a == "--snapshot-id")
        .map(|i| args[i + 1].clone())
        .unwrap_or_else(|| "2026-05-28T0000Z".into());
    let geoip_path = args.iter().position(|a| a == "--geoip").map(|i| PathBuf::from(&args[i + 1]));
    let overrides_path = args.iter().position(|a| a == "--geo-overrides").map(|i| PathBuf::from(&args[i + 1]));

    eprintln!("ReachMap pipeline — building {} artifacts", COUNTRY_CODE);
    if let Some(ref lp) = lacnic_path { eprintln!("  LACNIC: {}", lp.display()); }
    if let Some(ref pf) = prefix_file { eprintln!("  Prefix file: {}", pf.display()); }
    eprintln!("  {} RIBs:", rib_args.len());
    for (cid, path) in &rib_args { eprintln!("    {} → {}", cid, path.display()); }
    eprintln!("  GeoIP:  {}", geoip_path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "none".into()));
    eprintln!("  Overrides: {}", overrides_path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "none".into()));
    eprintln!("  Out:    {}", out_dir.display());

    fs::create_dir_all(&out_dir)?;
    fs::create_dir_all(out_dir.join("vantages"))?;
    fs::create_dir_all(out_dir.join("asns"))?;

    // Load geo resources
    let overrides: HashMap<String, GeoOverride> = overrides_path
        .as_ref()
        .map(|p| load_overrides(p))
        .transpose()?
        .unwrap_or_default();

    let geoip_reader: Option<maxminddb::Reader<Vec<u8>>> = geoip_path
        .as_ref()
        .and_then(|p| {
            match fs::read(p) {
                Ok(buf) => match maxminddb::Reader::from_source(buf) {
                    Ok(r) => {
                        eprintln!("  GeoIP loaded: {} bytes", p.metadata().ok().map(|m| m.len()).unwrap_or(0));
                        Some(r)
                    }
                    Err(e) => {
                        eprintln!("  Warning: failed to open GeoIP database: {}", e);
                        None
                    }
                },
                Err(e) => {
                    eprintln!("  Warning: cannot read GeoIP file: {}", e);
                    None
                }
            }
        });

    // ── Step 1: Get prefix set ───────────────────────────────
    let mut prefixes: Vec<CountryPrefix> = Vec::new();
    let mut ip24_to_prefix: HashMap<u32, usize> = HashMap::new();

    if let Some(pf) = &prefix_file {
        eprintln!("\n[1/4] Loading prefix file: {}", pf.display());
        let data = fs::read_to_string(pf)?;
        let wrapper: serde_json::Value = serde_json::from_str(&data)?;
        let pfx_array = wrapper["prefixes"].as_array()
            .context("prefixes file missing 'prefixes' array")?;
        for p in pfx_array {
            let start = p["prefixStart"].as_u64().context("missing prefixStart")? as u32;
            let end = p["prefixEnd"].as_u64().context("missing prefixEnd")? as u32;
            let idx = prefixes.len();
            for b24 in (start >> 8)..=(end >> 8) {
                ip24_to_prefix.entry(b24).or_insert(idx);
            }
            prefixes.push(CountryPrefix {
                prefix: p["prefix"].as_str().unwrap_or("?").into(),
                prefix_start: start,
                prefix_end: end,
                prefix_length: p["prefixLength"].as_u64().unwrap_or(24) as u8,
                address_count: p["addressCount"].as_u64().unwrap_or(0) as u32,
                origin_asns: vec![],
                origin_names: vec![],
                observed_in_bgp: false,
                confidence: p["confidence"].as_str().unwrap_or("high").into(),
                rir_status: p["rirStatus"].as_str().unwrap_or("allocated").into(),
            });
        }
        eprintln!("  Loaded {} prefixes", prefixes.len());
    } else {
        let lacnic_path = lacnic_path.as_ref().context("Missing --lacnic <path> or --prefix-file <path>")?;
        eprintln!("\n[1/4] Parsing LACNIC delegated stats...");
        let lacnic_data = fs::read_to_string(lacnic_path)?;
        let delegated = parse_lacnic(&lacnic_data, COUNTRY_CODE);
        eprintln!("  {} IPv4 records for {}", delegated.len(), COUNTRY_CODE);

        for rec in &delegated {
            let start = ip_to_u32(&rec.start_address)
                .context(format!("Bad IP: {}", rec.start_address))?;
            let end = start + rec.address_count - 1;
            let (prefix_str, prefix_len) = cidr_from_count(&rec.start_address, rec.address_count);

            let idx = prefixes.len();
            for b24 in (start >> 8)..=(end >> 8) {
                ip24_to_prefix.entry(b24).or_insert(idx);
            }
            prefixes.push(CountryPrefix {
                prefix: prefix_str,
                prefix_start: start,
                prefix_end: end,
                prefix_length: prefix_len,
                address_count: rec.address_count,
                origin_asns: vec![],
                origin_names: vec![],
                observed_in_bgp: false,
                confidence: if rec.status == "allocated" { "high".into() } else { "medium".into() },
                rir_status: rec.status.clone(),
            });
        }
    }

    // ── Step 2: Parse RIBs (multi-collector) ────────────────
    eprintln!("\n[2/4] Parsing RIB snapshots...");

    let mut peer_obs: HashMap<u32, Vec<RouteObs>> = HashMap::new();
    let mut peer_ips: HashMap<u32, HashSet<IpAddr>> = HashMap::new();
    let mut origin_asns_by_prefix: HashMap<usize, HashSet<u32>> = HashMap::new();
    let mut all_paths: HashSet<Vec<u32>> = HashSet::new();
    let mut path_prefixes: HashMap<Vec<u32>, HashSet<String>> = HashMap::new();
    let mut path_peers: HashMap<Vec<u32>, HashSet<u32>> = HashMap::new();
    let mut grand_total = 0u64;
    let mut grand_matched = 0u64;

    // Per-collector storage
    let mut collector_peer_obs: HashMap<String, HashMap<u32, Vec<RouteObs>>> = HashMap::new();
    let mut collector_peer_ips: HashMap<String, HashMap<u32, HashSet<IpAddr>>> = HashMap::new();
    let mut collector_stats: Vec<CollectorStat> = Vec::new();

    #[derive(Debug, Clone)]
    struct CollectorStat {
        collector_id: String,
        mrt_filename: String,
        total_elements: u64,
        matched_elements: u64,
    }

    for (cid, rib_path) in &rib_args {
        eprintln!("  Parsing {} ...", cid);
        let parser = BgpkitParser::new(rib_path.to_string_lossy().as_ref())
            .context(format!("Failed to create parser for {}", cid))?;

        let mut c_peer_obs: HashMap<u32, Vec<RouteObs>> = HashMap::new();
        let mut c_peer_ips: HashMap<u32, HashSet<IpAddr>> = HashMap::new();
        let mut total = 0u64;
        let mut matched = 0u64;

        for elem in parser {
            total += 1;
            if total % 5_000_000 == 0 {
                eprintln!("    ... {}M, {} matched", total / 1_000_000, matched);
            }

            let ipnet = elem.prefix.prefix;
            let prefix_str = ipnet.to_string();
            let announced_ip = match ipnet.addr() {
                std::net::IpAddr::V4(ipv4) => u32::from(ipv4),
                _ => continue,
            };
            let announced_24 = announced_ip >> 8;

            let pfx_idx = match ip24_to_prefix.get(&announced_24) {
                Some(&i) => i,
                None => continue,
            };
            matched += 1;

            let peer: u32 = elem.peer_asn.into();
            c_peer_ips.entry(peer).or_default().insert(elem.peer_ip);
            peer_ips.entry(peer).or_default().insert(elem.peer_ip);

            let origin: u32 = elem.origin_asns
                .as_ref().and_then(|v| v.first().copied()).map(Into::into).unwrap_or(0);
            let raw_path: Vec<u32> = elem.as_path
                .as_ref().and_then(|ap| ap.to_u32_vec_opt(false)).unwrap_or_default();
            let norm = normalize_path(&raw_path);

            origin_asns_by_prefix.entry(pfx_idx).or_default().insert(origin);
            path_prefixes.entry(norm.clone()).or_default().insert(prefix_str.clone());
            path_peers.entry(norm.clone()).or_default().insert(peer);
            all_paths.insert(norm);

            c_peer_obs.entry(peer).or_default().push(RouteObs {
                peer_asn: peer, origin_asn: origin,
                prefix: prefix_str.clone(), as_path: raw_path.clone(),
            });
            peer_obs.entry(peer).or_default().push(RouteObs {
                peer_asn: peer, origin_asn: origin,
                prefix: prefix_str, as_path: raw_path,
            });
        }

        eprintln!("    {}M elements, {} matched Cuba", total / 1_000_000, matched);
        collector_peer_obs.insert(cid.clone(), c_peer_obs);
        collector_peer_ips.insert(cid.clone(), c_peer_ips);
        collector_stats.push(CollectorStat {
            collector_id: cid.clone(),
            mrt_filename: rib_path.file_name().unwrap_or_default().to_string_lossy().into(),
            total_elements: total,
            matched_elements: matched,
        });
        grand_total += total;
        grand_matched += matched;
    }

    eprintln!("  All collectors: {}M elements, {} matched Cuba", grand_total / 1_000_000, grand_matched);

    // Update prefix BGP status
    for (idx, origins) in &origin_asns_by_prefix {
        if let Some(p) = prefixes.get_mut(*idx) {
            p.observed_in_bgp = true;
            p.origin_asns = { let mut v: Vec<u32> = origins.iter().copied().collect(); v.sort(); v };
            p.origin_names = p.origin_asns.iter().map(|_| "unknown".to_string()).collect();
        }
    }

    let all_observed: HashSet<String> = prefixes.iter()
        .filter(|p| p.observed_in_bgp).map(|p| p.prefix.clone()).collect();

    let snap = SnapshotMetadata {
        source: "routeviews".into(),
        collector: "route-views2".into(),
        rib_timestamp: "2026-05-28T00:00:00Z".into(),
        downloaded_at: "2026-05-28T19:48:00Z".into(),
        mrt_filename: "rib.20260528.0000.bz2".into(),
    };

    // ── Step 3: Viewpoints & ASN aggregates ─────────────────
    eprintln!("\n[3/4] Building viewpoints and ASN aggregates...");
    let mut vp_ids: Vec<String> = Vec::new();
    let mut asn_to_vps: HashMap<u32, Vec<String>> = HashMap::new();

    for (&peer, observations) in &peer_obs {
        if peer == 0 { continue; }

        let vp_id = format!("vp-{}", peer);
        let visible: HashSet<String> = observations.iter().map(|o| o.prefix.clone()).collect();
        let mut visible_list: Vec<String> = visible.iter().cloned().collect();
        visible_list.sort();
        let mut missing_list: Vec<String> = all_observed.difference(&visible).cloned().collect();
        missing_list.sort();

        let obs_prefixes: HashSet<String> = observations.iter().map(|o| o.prefix.clone()).collect();
        let mut pf_ids: Vec<String> = Vec::new();
        for path in &all_paths {
            if let Some(pp) = path_prefixes.get(path) {
                if pp.iter().any(|p| obs_prefixes.contains(p)) {
                    pf_ids.push(path_family_id(path));
                }
            }
        }
        pf_ids.sort();
        pf_ids.dedup();

        // Resolve geo
        let peer_ip = peer_ips.get(&peer).and_then(|ips| ips.iter().next().copied());
        let geo = resolve_geo("route-views2", peer, &peer_ip, &overrides, &geoip_reader);
        let region_group = assign_region_group(&geo);

        let vp = ViewpointArtifact {
            id: vp_id.clone(),
            collector: "route-views2".into(),
            peer_asn: peer,
            peer_as_name: None,
            peer_ip: peer_ip.map(|ip| ip.to_string()),
            geo,
            display_name: format!("AS{}", peer),
            region_group,
            visible_prefixes: visible_list,
            missing_prefixes: missing_list,
            path_family_ids: pf_ids,
            snapshot: snap.clone(),
        };
        fs::write(
            out_dir.join("vantages").join(format!("{}.json", vp_id)),
            serde_json::to_string_pretty(&vp)?,
        )?;
        vp_ids.push(vp_id.clone());
        asn_to_vps.entry(peer).or_default().push(vp_id);
    }

    vp_ids.sort();
    fs::write(
        out_dir.join("vantages/index.json"),
        serde_json::to_string_pretty(&ViewpointIndex {
            country_code: COUNTRY_CODE.into(),
            generated_ts: snap.rib_timestamp.clone(),
            viewpoint_ids: vp_ids.clone(),
        })?,
    )?;

    // ASN aggregates
    let mut asn_list: Vec<u32> = peer_obs.keys().filter(|&&a| a != 0).copied().collect();
    asn_list.sort();

    for &asn in &asn_list {
        let vps = asn_to_vps.get(&asn).cloned().unwrap_or_default();
        let mut asn_visible: HashSet<String> = HashSet::new();
        let mut asn_pf_ids: HashSet<String> = HashSet::new();

        for vp_id in &vps {
            let path = out_dir.join("vantages").join(format!("{}.json", vp_id));
            if let Ok(data) = fs::read_to_string(&path) {
                if let Ok(vp) = serde_json::from_str::<ViewpointArtifact>(&data) {
                    for p in vp.visible_prefixes { asn_visible.insert(p); }
                    for pf in vp.path_family_ids { asn_pf_ids.insert(pf); }
                }
            }
        }

        let mut sorted_vis: Vec<String> = asn_visible.iter().cloned().collect();
        sorted_vis.sort();
        let mut sorted_mis: Vec<String> = all_observed.difference(&asn_visible).cloned().collect();
        sorted_mis.sort();
        let mut sorted_pf: Vec<String> = asn_pf_ids.iter().cloned().collect();
        sorted_pf.sort();

        fs::write(
            out_dir.join("asns").join(format!("AS{}.json", asn)),
            serde_json::to_string_pretty(&AsViewArtifact {
                peer_asn: asn,
                peer_as_name: None,
                viewpoint_ids: vps,
                visible_prefixes: sorted_vis,
                missing_prefixes: sorted_mis,
                path_family_ids: sorted_pf,
            })?,
        )?;
    }

    fs::write(
        out_dir.join("asns/index.json"),
        serde_json::to_string_pretty(&AsnIndex {
            country_code: COUNTRY_CODE.into(),
            generated_ts: snap.rib_timestamp.clone(),
            asns: asn_list.clone(),
        })?,
    )?;

    // ── Step 3.5: Collectors & Consensus ────────────────────
    eprintln!("\n[3.5/4] Building collector visibility and consensus...");

    // Load collector definitions
    let collectors_path = std::path::Path::new("config/collectors.json");
    let collectors_def: CollectorsFile = if collectors_path.exists() {
        let data = fs::read_to_string(collectors_path)?;
        serde_json::from_str(&data).unwrap_or_else(|_| CollectorsFile { description: String::new(), collectors: HashMap::new() })
    } else {
        CollectorsFile { description: String::new(), collectors: HashMap::new() }
    };

    // Create output directories
    fs::create_dir_all(out_dir.join("collectors"))?;
    fs::create_dir_all(out_dir.join("peer-observations"))?;
    fs::create_dir_all(out_dir.join("visibility/regions"))?;
    let snap_dir = format!("snapshots/{}", snapshot_id);
    fs::create_dir_all(out_dir.join(&snap_dir))?;

    let mut collector_ids: Vec<String> = Vec::new();
    let mut peer_obs_ids: Vec<String> = Vec::new();

    // Build per-collector visibility from each collector's peer observations
    for (cid, c_peer_obs) in &collector_peer_obs {
        let c_ips = collector_peer_ips.get(cid);
        let collector_def = collectors_def.collectors.get(cid);

        let mut col_visible: HashSet<String> = HashSet::new();
        let mut col_obs_ids: Vec<String> = Vec::new();

        for (&peer, observations) in c_peer_obs {
            if peer == 0 { continue; }
            let obs_id = format!("po-{}-{}", cid, peer);
            let visible: HashSet<String> = observations.iter().map(|o| o.prefix.clone()).collect();
            let mut vis_list: Vec<String> = visible.iter().cloned().collect();
            vis_list.sort();

            let obs_pfx: HashSet<String> = observations.iter().map(|o| o.prefix.clone()).collect();
            let mut obs_pf_ids: Vec<String> = Vec::new();
            for path in &all_paths {
                if let Some(pp) = path_prefixes.get(path) {
                    if pp.iter().any(|p| obs_pfx.contains(p)) {
                        obs_pf_ids.push(path_family_id(path));
                    }
                }
            }
            obs_pf_ids.sort();
            obs_pf_ids.dedup();

            let peer_ip = c_ips.and_then(|ips| ips.get(&peer)).and_then(|ips| ips.iter().next().copied());

            let source = if cid.starts_with("rrc") { "ris" } else { "routeviews" };
            let po = PeerObservationArtifact {
                id: obs_id.clone(),
                collector_id: cid.clone(),
                peer_asn: peer,
                peer_as_name: None,
                peer_ip: peer_ip.map(|ip| ip.to_string()),
                peer_locality: "unknown".into(),
                locality_evidence: None,
                included_in_geo_consensus: true,
                geo_interpretation: "collector_rib".into(),
                visible_prefixes: vis_list,
                path_family_ids: obs_pf_ids.clone(),
                snapshot: SnapshotMetadata {
                    source: source.into(), collector: cid.clone(),
                    rib_timestamp: "2026-05-28T00:00:00Z".into(),
                    downloaded_at: "2026-05-28T19:48:00Z".into(),
                    mrt_filename: format!("{}.gz", cid),
                },
            };
            fs::write(out_dir.join("peer-observations").join(format!("{}.json", obs_id)), serde_json::to_string_pretty(&po)?)?;
            peer_obs_ids.push(obs_id.clone());
            col_obs_ids.push(obs_id);
            for pfx in &po.visible_prefixes { col_visible.insert(pfx.clone()); }
        }

        let mut col_vis_list: Vec<String> = col_visible.iter().cloned().collect();
        col_vis_list.sort();
        let mut col_mis_list: Vec<String> = all_observed.difference(&col_visible).cloned().collect();
        col_mis_list.sort();

        if let Some(cdef) = collector_def {
            let source = if cid.starts_with("rrc") { "ris" } else { "routeviews" };
            let cv = CollectorVisibilityArtifact {
                collector_id: cid.clone(),
                collector_name: cdef.name.clone(),
                collector_source: cdef.source.clone(),
                latitude: cdef.latitude, longitude: cdef.longitude,
                city: cdef.city.clone(), country_code: cdef.country_code.clone(),
                continent: cdef.continent.clone(),
                region_group: cdef.region_group.clone().unwrap_or_else(|| "Other".into()),
                confidence: cdef.confidence,
                peer_observation_ids: col_obs_ids,
                visible_prefixes: col_vis_list,
                missing_prefixes: col_mis_list,
                path_family_ids: Vec::new(),
                snapshot: SnapshotMetadata {
                    source: source.into(), collector: cid.clone(),
                    rib_timestamp: "2026-05-28T00:00:00Z".into(),
                    downloaded_at: "2026-05-28T19:48:00Z".into(),
                    mrt_filename: collector_stats.iter().find(|s| s.collector_id == *cid).map(|s| s.mrt_filename.clone()).unwrap_or_default(),
                },
            };
            fs::write(out_dir.join("collectors").join(format!("{}.json", cid)), serde_json::to_string_pretty(&cv)?)?;
            collector_ids.push(cid.clone());
        }
    }
    // Collector index
    collector_ids.sort();
    fs::write(
        out_dir.join("collectors/index.json"),
        serde_json::to_string_pretty(&serde_json::json!({
            "countryCode": COUNTRY_CODE,
            "generatedTs": snap.rib_timestamp,
            "collectorIds": collector_ids,
        }))?,
    )?;

    // Consensus visibility (all collectors)
    // Uses LACNIC allocation prefixes as keys, checking overlap with BGP sub-prefixes
    {
        let total_collectors = collector_ids.len();

        // Build per-collector BGP-visible prefix IP ranges for overlap checking
        let mut collector_bgp_ranges: HashMap<String, Vec<(u32, u32)>> = HashMap::new();
        for cid in &collector_ids {
            if let Ok(data) = fs::read_to_string(out_dir.join("collectors").join(format!("{}.json", cid))) {
                if let Ok(cv) = serde_json::from_str::<CollectorVisibilityArtifact>(&data) {
                    let ranges: Vec<(u32, u32)> = cv.visible_prefixes.iter()
                        .filter_map(|p| parse_prefix_to_range(p))
                        .collect();
                    collector_bgp_ranges.insert(cid.clone(), ranges);
                }
            }
        }

        // For each LACNIC allocation prefix, check which collectors see it
        let mut vis_by_prefix: HashMap<String, PrefixVisibilityScore> = HashMap::new();
        for pfx in &prefixes {
            if !pfx.observed_in_bgp { continue; }

            let mut obs_cols: Vec<String> = Vec::new();
            let mut missing_cols: Vec<String> = Vec::new();

            for cid in &collector_ids {
                let ranges = collector_bgp_ranges.get(cid);
                let seen = ranges.map(|rs| rs.iter().any(|(s, e)| {
                    pfx.prefix_start <= *e && pfx.prefix_end >= *s
                })).unwrap_or(false);

                if seen { obs_cols.push(cid.clone()); }
                else { missing_cols.push(cid.clone()); }
            }

            let ratio = if total_collectors > 0 { obs_cols.len() as f64 / total_collectors as f64 } else { 0.0 };

            vis_by_prefix.insert(pfx.prefix.clone(), PrefixVisibilityScore {
                prefix: pfx.prefix.clone(),
                observed_collectors: obs_cols.len(),
                total_collectors,
                visibility_ratio: ratio,
                observed_collector_ids: obs_cols,
                missing_collector_ids: missing_cols,
            });
        }

        fs::write(
            out_dir.join("visibility/consensus-all.json"),
            serde_json::to_string_pretty(&ConsensusVisibilityArtifact {
                scope: "all_collectors".into(),
                collector_ids: collector_ids.clone(),
                total_collectors,
                visibility_by_prefix: vis_by_prefix,
            })?,
        )?;
    }

    // Write snapshot metadata (multi-collector)
    fs::write(
        out_dir.join(&snap_dir).join("metadata.json"),
        serde_json::to_string_pretty(&serde_json::json!({
            "snapshotId": snapshot_id,
            "countryCode": COUNTRY_CODE,
            "targetTimestamp": "2026-05-28T00:00:00Z",
            "totalCollectors": collector_ids.len(),
            "totalElements": grand_total,
            "matchedCubaElements": grand_matched,
            "peerAsnCount": asn_list.len(),
            "pathFamilyCount": 0,
            "collectors": collector_stats.iter().map(|s| serde_json::json!({
                "collectorId": s.collector_id,
                "source": if s.collector_id.starts_with("rrc") { "ris" } else { "routeviews" },
                "ribTimestamp": "2026-05-28T00:00:00Z",
                "mrtFilename": s.mrt_filename,
                "totalElementsParsed": s.total_elements,
                "matchedCountryElements": s.matched_elements,
            })).collect::<Vec<_>>(),
            "notes": [
                "BGP visibility from collector RIBs — not proven data-plane reachability.",
                "A collector 'observes' a prefix if at least one peer sees an overlapping BGP prefix.",
                "Consensus ratio = observedCollectors / totalCollectors."
            ],
        }))?,
    )?;

    eprintln!("  Collectors: {}", collector_ids.len());
    eprintln!("  Peer observations: {}", peer_obs_ids.len());

    // ── Step 4: Path families & prefixes ────────────────────
    eprintln!("\n[4/4] Building path families and final artifacts...");
    let mut families: Vec<PathFamilyArtifact> = Vec::new();
    for path in &all_paths {
        let pf_id = path_family_id(path);
        let upstream = if path.len() >= 2 { path[path.len() - 2] } else { 0 };
        let origin = path.last().copied().unwrap_or(0);
        let mut pfx: Vec<String> = path_prefixes.get(path).cloned().unwrap_or_default().iter().cloned().collect();
        pfx.sort();
        let mut collectors: Vec<String> = path_peers.get(path).cloned().unwrap_or_default()
            .iter().map(|p| format!("AS{}", p)).collect();
        collectors.sort();

        families.push(PathFamilyArtifact {
            id: pf_id,
            normalized_path: path.clone(),
            upstream_asn: upstream,
            origin_asn: origin,
            prefixes: pfx,
            collectors,
            observation_count: 0,
        });
    }
    families.sort_by_key(|pf| (pf.origin_asn, pf.upstream_asn));

    fs::write(out_dir.join("path-families.json"), serde_json::to_string_pretty(&families)?)?;

    let prefix_count = prefixes.len();
    let total_addrs: u64 = prefixes.iter().map(|p| p.address_count as u64).sum();
    let obs_count = prefixes.iter().filter(|p| p.observed_in_bgp).count();

    fs::write(out_dir.join("prefixes.json"), serde_json::to_string_pretty(&serde_json::json!({
        "countryCode": COUNTRY_CODE,
        "countryName": COUNTRY_NAME,
        "generatedTs": snap.rib_timestamp,
        "source": "lacnic-delegated-extended",
        "sourceSerial": "20260527",
        "totalPrefixes": prefix_count,
        "totalAddresses": total_addrs,
        "observedInBgp": obs_count,
        "prefixes": prefixes,
    }))?)?;

    eprintln!("\nDone.");
    eprintln!("  Prefixes: {} total, {} in BGP", prefix_count, obs_count);
    eprintln!("  Viewpoints: {}", vp_ids.len());
    eprintln!("  ASN aggregates: {}", asn_list.len());
    eprintln!("  Path families: {}", families.len());
    eprintln!("  Output: {}", out_dir.display());

    Ok(())
}
