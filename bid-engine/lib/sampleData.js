/**
 * BidEngine AI — Realistic Hackathon Sample Dataset
 * This file serves pre-loaded data demonstrating capability libraries, historical bids, and evaluation criteria.
 */

// 1. CAPABILITY LIBRARY - 50 PROJECTS IN 5 CATEGORIES
export const CAPABILITY_LIBRARY = [
  // ===================== IT SERVICES (10 Projects) =====================
  {
    id: "CAP-IT-001",
    project_name: "Sovereign Cloud Migration Initiative",
    description: "Successfully migrated legacy state infrastructure to a highly secure Sovereign Cloud environment supporting compliant and zero-leak operations for sensitive civic records.",
    skills: ["Cloud Migration", "Terraform", "Sovereign Cloud", "Infrastructure as Code", "PostgreSQL"],
    year_completed: 2025,
    contract_value: "$1,850,000",
    client_type: "Government (State)",
    certifications: ["FedRAMP High", "ISO 27001", "CIS Benchmark"]
  },
  {
    id: "CAP-IT-002",
    project_name: "High Performance Computing Cluster Implementation",
    description: "Engineered and deployed an on-premise High Performance Computing (HPC) cluster with multi-node redundancy, supporting high-speed machine learning training modeling.",
    skills: ["HPC", "Slurm Scheduler", "InfiniBand", "Linux Admin", "Hardware Orchestration"],
    year_completed: 2024,
    contract_value: "$3,400,000",
    client_type: "Academic & Research",
    certifications: ["ISO 9001", "NIST SP 800-171"]
  },
  {
    id: "CAP-IT-003",
    project_name: "AI-Driven Helpdesk Desk Solution",
    description: "Designed a secure internal enterprise helpdesk automation pipeline integrating custom Large Language Models for instant network troubleshooting and ticket routing.",
    skills: ["Natural Language Processing", "LangChain", "Vector Databases", "Python API", "React UI"],
    year_completed: 2026,
    contract_value: "$450,000",
    client_type: "Commercial Enterprise",
    certifications: ["SOC 2 Type II", "GDPR Compliant"]
  },
  {
    id: "CAP-IT-004",
    project_name: "Global Active Directory Consolidation",
    description: "Consolidated 14 disparate international domains into an optimized global Microsoft Active Directory with single sign-on capabilities.",
    skills: ["Active Directory", "Azure AD", "Identity Management", "PowerShell", "Network Security"],
    year_completed: 2023,
    contract_value: "$950,000",
    client_type: "Global Retailer",
    certifications: ["ISO 27001", "SOC 1 Type II"]
  },
  {
    id: "CAP-IT-005",
    project_name: "Zero Trust Network Architecture Audit & Guard",
    description: "Executed comprehensive perimeter-less security modeling, deploying micro-segmentation policies across remote staff configurations.",
    skills: ["Zero Trust", "Cloudflare Access", "Micro-segmentation", "Firewall Analysis", "IAM"],
    year_completed: 2025,
    contract_value: "$720,000",
    client_type: "Financial Services",
    certifications: ["SOC 2 Type II", "PCI-DSS Level 1"]
  },
  {
    id: "CAP-IT-006",
    project_name: "Multi-Region Cloud Disaster Recovery Solution",
    description: "Created automated failover frameworks replicating critical relational transactional database structures with near-zero RTO targets.",
    skills: ["Disaster Recovery", "Database Replication", "AWS Route53", "Docker", "Bash Scripting"],
    year_completed: 2024,
    contract_value: "$1,200,000",
    client_type: "E-Commerce",
    certifications: ["ISO 22301 (BCM)", "AWS Certified Security"]
  },
  {
    id: "CAP-IT-007",
    project_name: "SaaS Platform Clinical Migration SOW",
    description: "Assisted state-wide medical networks in moving electronic records databases into HIPAA-compliant hybrid storage structures.",
    skills: ["HIPAA Compliance", "Data Masking", "HL7 Integration", "Kubernetes", "Redis Cache"],
    year_completed: 2025,
    contract_value: "$2,100,000",
    client_type: "Healthcare Provider",
    certifications: ["HIPAA verified", "SOC 2 Type II", "HITRUST CSF"]
  },
  {
    id: "CAP-IT-008",
    project_name: "SD-WAN Enterprise Global Transition",
    description: "Decommissioned costly MPLS circuits in favor of modern Software-Defined WAN infrastructures across 80 corporate storefront locations.",
    skills: ["SD-WAN", "Cisco Viptela", "Networking", "IPS/IDS", "Traffic Management"],
    year_completed: 2024,
    contract_value: "$1,600,000",
    client_type: "Logistics Enterprise",
    certifications: ["Cisco Certified Expert", "ISO 27001"]
  },
  {
    id: "CAP-IT-009",
    project_name: "Managed Security Operations Core",
    description: "Formulated full surveillance SOC handling SIEM alerts, vulnerability scans, and active penetration testing campaigns.",
    skills: ["Wazuh SIEM", "Penetration Testing", "Threat Hunting", "Yara Rules", "Compliance Auditing"],
    year_completed: 2025,
    contract_value: "$890,000",
    client_type: "Energy Grid Operator",
    certifications: ["CREST Approved", "SOC 2 Type II"]
  },
  {
    id: "CAP-IT-010",
    project_name: "Multi-Cloud Database Orchestration Pipeline",
    description: "Implemented a redundant, high-uptime cluster across AWS and Azure, satisfying 99.99% operational continuity mandates.",
    skills: ["Multi-Cloud", "PostgreSQL Aurora", "Kubernetes", "TLS 1.3", "Terraform"],
    year_completed: 2026,
    contract_value: "$1,350,000",
    client_type: "FinTech Hub",
    certifications: ["SOC 2 Type II", "PCI-DSS Compliant", "ISO 27017"]
  },

  // ===================== CONSTRUCTION (10 Projects) =====================
  {
    id: "CAP-CON-001",
    project_name: "Commercial Logistics Hub Airport SOW",
    description: "Built a modern 120,000 sq ft smart fulfillment depot warehouse including automated solar panel arrays and energy management loops.",
    skills: ["HVAC Installation", "Structural Steel", "Green Construction", "Site Drainage", "AutoCAD SOW"],
    year_completed: 2024,
    contract_value: "$14,500,000",
    client_type: "Private Logistics Corp",
    certifications: ["LEED Gold", "OSHA 30", "ISO 14001"]
  },
  {
    id: "CAP-CON-002",
    project_name: "Seismic Retrofit for Municipal Center",
    description: "Reinforced support pillars and foundations of a central administrative facility using FRP wrap technology to elevate seismic resistance thresholds.",
    skills: ["Seismic Retrofitting", "FRP Jackets", "Foundation Grouting", "Structural Engineering", "Slab Work"],
    year_completed: 2025,
    contract_value: "$5,200,000",
    client_type: "City Government",
    certifications: ["PE License Verified", "OSHA safe", "ISO 9001"]
  },
  {
    id: "CAP-CON-003",
    project_name: "Water Treatment Plant Filtration SOW",
    description: "Replaced high-flow clarifiers and integrated PLC control boards to streamline industrial water processing capacities safely.",
    skills: ["PLC Configuration", "Piping Systems", "Heavy Machinery", "Environmental Compliance", "Civil Engineering"],
    year_completed: 2023,
    contract_value: "$8,900,000",
    client_type: "Utilities Board",
    certifications: ["EPA Standard compliant", "ISO 45001"]
  },
  {
    id: "CAP-CON-004",
    project_name: "Net-Zero Corporate Headquarters",
    description: "Constructed an state-of-the-art office building leveraging geothermal wells, rainwater recapture, and insulated mass timber frameworks.",
    skills: ["Mass Timber", "Geothermal Drilling", "Rainwater Harvesting", "BIM Modeling", "LEED Management"],
    year_completed: 2025,
    contract_value: "$22,000,000",
    client_type: "Technology Enterprise",
    certifications: ["LEED Platinum", "WELL Building Standard", "Zero Carbon Certification"]
  },
  {
    id: "CAP-CON-005",
    project_name: "Prefabricated Modular Medical Testing Clinics",
    description: "Rapidly manufactured and assembled 6 modular clinical deployment sites equipped with negative pressure cleanroom specs.",
    skills: ["Prefabrication", "Cleanroom Engineering", "HEPA Filtration", "Modular Assembly", "Electrical Plumbing"],
    year_completed: 2024,
    contract_value: "$3,100,000",
    client_type: "Healthcare Network",
    certifications: ["Modular Building Association Approved", "ISO 13485"]
  },
  {
    id: "CAP-CON-006",
    project_name: "Fiber-Optic Urban Network Trenching",
    description: "Managed the micro-trenching of 45 miles of underground conduits through dense metropolitan business corridors with minimal traffic disruption.",
    skills: ["Micro-trenching", "Horizontal Drilling", "Utility Mapping", "GIS Tracking", "Sewer Crossings"],
    year_completed: 2025,
    contract_value: "$6,800,000",
    client_type: "Telecom Consortium",
    certifications: ["NEMA Standard Compliant", "OSHA 10"]
  },
  {
    id: "CAP-CON-007",
    project_name: "Smart Transit Multi-Level Parking Garage",
    description: "Completed construction of a 550-vehicle concrete parking structure integrating smart EV chargers and automated license-recognition entryways.",
    skills: ["Reinforced Concrete", "Precast Columns", "EV Station Wiring", "LPR Integrations", "Tension Cables"],
    year_completed: 2024,
    contract_value: "$11,200,000",
    client_type: "Municipal Transit Agency",
    certifications: ["Parksmart Bronze", "ACI Certification"]
  },
  {
    id: "CAP-CON-008",
    project_name: "Industrial Shipping Port Expansion",
    description: "Dredged berth lanes and cast robust deep-foundation maritime tiebacks supporting heavy crane operations on shipping container docks.",
    skills: ["Marine Dredging", "Sheet Pile Driving", "Cast Concrete Piers", "Maritime Logistics", "Hydrographic Surveys"],
    year_completed: 2023,
    contract_value: "$18,500,000",
    client_type: "Harbor Commission",
    certifications: ["USACE Standard Compliant", "ISO 14001"]
  },
  {
    id: "CAP-CON-009",
    project_name: "High-Security Military Hangar Build",
    description: "Designed and built heavy-span aircraft assembly hangars incorporating anti-static flooring, fire suppression systems, and blast walls.",
    skills: ["Spans & Trusses", "Anti-static Epoxy Floors", "Deluge Fire Systems", "RF Shielding", "Sensitive Access Zoning"],
    year_completed: 2025,
    contract_value: "$16,000,000",
    client_type: "Defense Department",
    certifications: ["DoD Security Clearance Standard", "UFC Compliant"]
  },
  {
    id: "CAP-CON-010",
    project_name: "Central Campus Geothermal Retrofit",
    description: "Drilled and connected deep borehole closed-loop HVAC systems substituting ancient steam boiler frameworks across historic campuses.",
    skills: ["Borehole Drilling", "Chiller Loops", "Hydronic Heating", "HVAC Design", "Asbestos Abatement"],
    year_completed: 2026,
    contract_value: "$7,350,000",
    client_type: "State University System",
    certifications: ["IGSHPA Certified", "PE Structural Certification"]
  },

  // ===================== LOGISTICS (10 Projects) =====================
  {
    id: "CAP-LOG-001",
    project_name: "Automated Distribution Sorting Refurb",
    description: "Overhauled fulfillment facility with modern conveyor belts and intelligent camera barcode scanners to double automated transit outputs.",
    skills: ["Sortation Conveyors", "Cognex Scanners", "Warehouse Control Systems", "SCADA Integration", "API Tracking"],
    year_completed: 2024,
    contract_value: "$2,800,000",
    client_type: "Retail Delivery Brand",
    certifications: ["CE Mark", "ISO 9001"]
  },
  {
    id: "CAP-LOG-002",
    project_name: "Last-Mile Delivery Vehicle Analytics",
    description: "Implemented real-time GPS telemetry devices across 400 delivery vans, enabling machine-driven route optimizations to cut fuel usage.",
    skills: ["Fleet Telematics", "Route Planning Algorithms", "GPS Tracking API", "IoT Device Integration", "Big Data Analytics"],
    year_completed: 2025,
    contract_value: "$1,100,000",
    client_type: "Logistics Enterprise",
    certifications: ["GDPR Compliant", "ISO 27001"]
  },
  {
    id: "CAP-LOG-003",
    project_name: "Intermodal Shipping Port Orchestration",
    description: "Developed automated container tracking software bridging incoming cargo ship manifests directly with local rail shipping yards.",
    skills: ["EDI Transactions", "EDIFACT Standards", "Rail Broker APIs", "Container Matching", "Database Performance"],
    year_completed: 2023,
    contract_value: "$3,600,000",
    client_type: "Port Operator",
    certifications: ["C-TPAT Compliant", "ISO 28000"]
  },
  {
    id: "CAP-LOG-004",
    project_name: "Pharmaceutical Cold Chain Control",
    description: "Designed redundant automated cooling grids keeping medicine shipping crates within strict temperature constraints under real-time alerts.",
    skills: ["Cold Chain Support", "Automated Thermostats", "MQTT IoT Gateway", "Custom Logging Alerts", "SLA Auditing"],
    year_completed: 2025,
    contract_value: "$1,950,000",
    client_type: "Biotech Enterprise",
    certifications: ["FDA GDP (Good Distribution Practice)", "ISO 13485"]
  },
  {
    id: "CAP-LOG-005",
    project_name: "Smart Warehouse AGV Fleet Rollout",
    description: "Commissioned the navigation mapping grid and operations server controlling 35 automated guided vehicles in heavy manufacturing bays.",
    skills: ["AGV Programming", "LiDAR Mapping", "Fleet Manager Software", "Wi-Fi Redundancy", "Industrial Safety Devices"],
    year_completed: 2024,
    contract_value: "$4,200,000",
    client_type: "Heavy Industry Corp",
    certifications: ["ISO 3691-4", "CE Certification", "OSHA Standard"]
  },
  {
    id: "CAP-LOG-006",
    project_name: "Cross-Border Customs Automated Portal",
    description: "Implemented an electronic processing integration for simplified clearance, automating commercial invoice verifications and tariff rates.",
    skills: ["Customs API", "Invoice Extraction OCR", "Tariff Calculations", "PostgreSQL", "React UI"],
    year_completed: 2025,
    contract_value: "$820,000",
    client_type: "Customs Brokering Corp",
    certifications: ["Authorized Economic Operator (AEO)", "SOC 2 Type II"]
  },
  {
    id: "CAP-LOG-007",
    project_name: "Enterprise RFID Real-Time Supply Chain",
    description: "Deployed active RFID scanning portals across 12 dry storage distribution hubs to enable continuous automated inventory assessments.",
    skills: ["RFID Sensors", "Middleware Orchestration", "ERP Connection SAP", "SQL Database Tuning", "Event Streams"],
    year_completed: 2024,
    contract_value: "$2,300,000",
    client_type: "Apparel Retailer",
    certifications: ["GS1 EPCglobal Standard", "ISO 18000-6C"]
  },
  {
    id: "CAP-LOG-008",
    project_name: "Humanitarian Emergency Cargo Network",
    description: "Orchestrated charter flights, localized warehousing, and customs escorts delivering emergency relief supplies during extreme weather crises.",
    skills: ["Emergency Logistics", "Air Charter Brokerage", "Cold Storage", "International Clearances", "Last-Mile Distribution"],
    year_completed: 2025,
    contract_value: "$1,500,000",
    client_type: "Non-Profit NGO",
    certifications: ["UN Procurement approved status", "ISO 9001"]
  },
  {
    id: "CAP-LOG-009",
    project_name: "Sustain-Loop Reverse Logistics Network",
    description: "Restructured product return processing to automate sorting between warranty repairs, reuse parts salvages, or recycling channels.",
    skills: ["Reverse Logistics", "Refurbishment Processes", "WEEE Disposal Standards", "Warranty Automation Core", "CO2 Accounting"],
    year_completed: 2024,
    contract_value: "$1,750,000",
    client_type: "Electronics Manufacturer",
    certifications: ["ISO 14001", "R2 (Responsible Recycling) Cert"]
  },
  {
    id: "CAP-LOG-010",
    project_name: "Armored High-Value Micro-Transit Routes",
    description: "Secured freight transit logistics for bullion and confidential electronics, employing smart locks, perimeter alerts, and dedicated guards.",
    skills: ["Armored Transport", "Biometric Lock Systems", "Geofencing Traps", "Active Panic Terminals", "Dispatch Control Core"],
    year_completed: 2026,
    contract_value: "$2,900,000",
    client_type: "Private Banking Consortium",
    certifications: ["ISO 28000", "Transported Asset Protection Association (TAPA)"]
  },

  // ===================== CONSULTING (10 Projects) =====================
  {
    id: "CAP-CON-101",
    project_name: "National Energy Strategy Roadmap",
    description: "Evaluated grid transmission bottlenecks and formulated carbon transition compliance matrices toward 2035 green goals.",
    skills: ["Macro Analysis", "Energy Grid Policy", "Stakeholder Alignment", "Financial Hedging", "Economic Impact Modeling"],
    year_completed: 2024,
    contract_value: "$1,200,000",
    client_type: "Department of Energy",
    certifications: ["ISO 50001 Energy", "Certified Energy Manager"]
  },
  {
    id: "CAP-CON-102",
    project_name: "Mergers & Acquisitions Tech Alignment",
    description: "Guided financial consolidation project auditing enterprise IT architectures and migrating redundant enterprise ERP applications safely.",
    skills: ["M&A Due Diligence", "ERP Auditing", "IT Cost Optimization", "Contract Negotiations", "Post-Merger Integration"],
    year_completed: 2025,
    contract_value: "$1,650,000",
    client_type: "Investment Firm",
    certifications: ["CISA", "ITIL v4 Master"]
  },
  {
    id: "CAP-CON-103",
    project_name: "Corporate ESG Sustainability Metrics",
    description: "Drafted compliance frameworks for real-time reporting on carbon output scopes 1, 2, and 3 across discrete global manufacturers.",
    skills: ["ESG Assessment", "Carbon Accounting", "GRI Standards", "Audit Preparation", "Supply Chain Scope Analyses"],
    year_completed: 2025,
    contract_value: "$450,000",
    client_type: "Consumer Goods Corp",
    certifications: ["SBTi Standards Companion", "SASB Certified"]
  },
  {
    id: "CAP-CON-104",
    project_name: "Enterprise Risk Management Defense",
    description: "Analyzed supply vulnerabilities, operational safety vectors, and systemic regulatory hurdles to construct response plans.",
    skills: ["Risk Modeling", "Business Continuity", "FMEA Diagnostics", "Regulatory Compliance", "Crisis Command Structure"],
    year_completed: 2024,
    contract_value: "$750,000",
    client_type: "Pharmaceutical Manufacturer",
    certifications: ["ISO 31000", "CISM", "ISO 22301"]
  },
  {
    id: "CAP-CON-105",
    project_name: "Supply Chain Resilience Diagnostic SOW",
    description: "Audited critical logistics patterns for a global aviation manufacturer, identifying key single-source component bottlenecks.",
    skills: ["Supply Diagnostics", "Dual-Sourcing Strategies", "Tariff Exposure Analysis", "Inventory Buffers", "Lead-Time Prediction"],
    year_completed: 2025,
    contract_value: "$880,000",
    client_type: "Aerospace Corp",
    certifications: ["ASMC Approved Partner", "SCOR Certified"]
  },
  {
    id: "CAP-CON-106",
    project_name: "Change Leadership Integration Program",
    description: "Conducted agile modernization coaching for 4,000 corporate team members undergoing standard productivity platform shifts.",
    skills: ["Change Management", "Prosci ADKAR Model", "Stakeholder Training Workshops", "E-learning Curriculum Build", "KPI Tracking Dashboards"],
    year_completed: 2024,
    contract_value: "$550,000",
    client_type: "Global Insurance Firm",
    certifications: ["Prosci Certified practitioner", "Agile Coach Cert"]
  },
  {
    id: "CAP-CON-107",
    project_name: "Treasury Operations Liquidity Optimization",
    description: "Redesigned accounts receivable models and implemented automated multi-currency pooling algorithms to boost operational working capital.",
    skills: ["Treasury Systems", "Cash Pool Algorithms", "FX Risk Hedging", "Bank Interface SWIFT", "Working Capital Audit"],
    year_completed: 2025,
    contract_value: "$980,000",
    client_type: "International Distributor",
    certifications: ["CFA charterholders led", "ISO 20022"]
  },
  {
    id: "CAP-CON-108",
    project_name: "Strategic Talent Acquisition Refactor",
    description: "Redesigned corporate recruitment strategies, sourcing structures, and candidate screening pathways using AI-powered applicant tracing systems.",
    skills: ["HR Tech Stack Optimization", "Sourcing Pathways", "DEI Metric Audits", "Competency Mapping", "ATS Integration"],
    year_completed: 2024,
    contract_value: "$380,000",
    client_type: "Defense Technology Partner",
    certifications: ["SHRM-SCP", "Sourcing Institute Approved"]
  },
  {
    id: "CAP-CON-109",
    project_name: "Agile Software Strategy Shift Initiative",
    description: "Transformed bureaucratic hardware-focused engineering structures into high-velocity agile scrum product frameworks.",
    skills: ["Agile Scaling Framework (SAFe)", "Jira Advanced Roadmaps", "Product Ownership Alignment", "Release Train Engineering"],
    year_completed: 2025,
    contract_value: "$1,120,000",
    client_type: "Automotive OEM Enterprise",
    certifications: ["SAFe Program Consultant (SPC)", "Scrum Alliance Trainer"]
  },
  {
    id: "CAP-CON-110",
    project_name: "Post-Pandemic Retail Network Rationalization",
    description: "Geospatially analyzed footprint statistics and localized target margins to consolidate brick-and-mortar storefront configurations.",
    skills: ["Geospatial Demographics GIS", "Foot-Traffic Analysis", "Lease Negotiation Audits", "Store Unit Economics", "Demographic Modeling"],
    year_completed: 2026,
    contract_value: "$1,450,000",
    client_type: "Department Store Chain",
    certifications: ["GIS Certified", "RICS Corporate Real Estate Standard"]
  },

  // ===================== SOFTWARE DEVELOPMENT (10 Projects) =====================
  {
    id: "CAP-SWE-001",
    project_name: "Enterprise FinTech Mobile Ecosystem",
    description: "Constructed bank-grade e-wallet app for iOS/Android supporting face biometric logs and lightning-speed transaction routing.",
    skills: ["React Native", "NodeJS Express", "AES-256 Encryption", "Biometrics Authentication", "Microservices API"],
    year_completed: 2025,
    contract_value: "$2,200,000",
    client_type: "Retail Bank Group",
    certifications: ["PCI-DSS Level 1", "OWASP ASVS Level 3", "SOC 2 Type II"]
  },
  {
    id: "CAP-SWE-002",
    project_name: "Microservices Checkout Engine Upgrade",
    description: "Re-built checkout pipeline to handle concurrent users on peak flash sales, reducing transaction dropouts down to absolute zero.",
    skills: ["Golang", "Apache Kafka", "Docker Engine", "Redis Cluster", "Prometheus Metrics"],
    year_completed: 2024,
    contract_value: "$1,800,000",
    client_type: "Global E-Retailer",
    certifications: ["PCI-DSS Compliant", "SOC 2 Type II"]
  },
  {
    id: "CAP-SWE-003",
    project_name: "AI-Powered Medical Diagnostic Image Parser",
    description: "Successfully trained convolutional neural nets to process MRI scans for rapid critical brain tissue damage detection.",
    skills: ["Python PyTorch", "FastAPI Core", "DICOM Image Systems", "TensorRT", "React Web Frontend"],
    year_completed: 2025,
    contract_value: "$1,450,000",
    client_type: "Private Clinic Network",
    certifications: ["FDA Class II Algorithm Guidance", "ISO 13485", "HIPAA Certified"]
  },
  {
    id: "CAP-SWE-004",
    project_name: "High-Frequency Proprietary Capital Exchange Core",
    description: "Engineered ultra-low latency event matching software for lightning-fast options transaction calculations.",
    skills: ["C++ HFT Engine", "Linux Kernel Tuning", "Socket programming TCP", "Single-Instruction Multiple-Data (SIMD)"],
    year_completed: 2024,
    contract_value: "$4,500,000",
    client_type: "Proprietary Trading Firm",
    certifications: ["SEC Technology compliance guidelines met", "Soc 1 Type II"]
  },
  {
    id: "CAP-SWE-005",
    project_name: "Decentralized Smart Contract Billing Platform",
    description: "Constructed secure Ethereum Solidity contracts handling automated licensing allocations and decentralized custody balances.",
    skills: ["Solidity Contracts", "Web3JS Integration", "IPFS Storage Nodes", "Hardhat testing", "Kakarot ZK Core"],
    year_completed: 2023,
    contract_value: "$620,000",
    client_type: "Digital Creator Pool",
    certifications: ["CertiK Smart Contract Certified", "ERC-20 Compliant"]
  },
  {
    id: "CAP-SWE-006",
    project_name: "SaaS Enterprise Human HR Suite",
    description: "Created multi-tenant web ecosystem managing employee checkins, payroll compliance, and dynamic payroll calculations.",
    skills: ["TypeScript Nextjs", "Tailwind CSS UI", "Supabase Client", "Drizzle SQL Core", "Stripe API Billing"],
    year_completed: 2025,
    contract_value: "$1,100,000",
    client_type: "Staffing Enterprise",
    certifications: ["SOC 2 Type II", "GDPR Verification"]
  },
  {
    id: "CAP-SWE-007",
    project_name: "Vehicle Telemetry IoT Processing Mesh",
    description: "Assembled event listeners recording acceleration, engine heat, and battery levels for real-time diagnostics mapping.",
    skills: ["MQTT Broker", "Apache Flink", "InfluxDB Time-series", "Rust IoT Edge", "Grafana dashboards"],
    year_completed: 2025,
    contract_value: "$2,650,000",
    client_type: "Fleet Logistics Brand",
    certifications: ["ISO 26262 Auto Security", "SOC 2 Type II"]
  },
  {
    id: "CAP-SWE-008",
    project_name: "Smart IVR Interactive Customer Voice Assistant",
    description: "Wrote high-grade voice recognition call center bots resolving 40% of standard account queries instantly.",
    skills: ["Twilio Voice API", "NodeJS Express", "OpenAI Speech API", "Cognitive Intents", "Webhook pipelines"],
    year_completed: 2024,
    contract_value: "$890,000",
    client_type: "Telecom Network",
    certifications: ["PCI DSS v4 voice compliant", "HIPAA Compliant"]
  },
  {
    id: "CAP-SWE-009",
    project_name: "Multi-Tenant LMS Classroom Suite",
    description: "Assembled intuitive web layouts enabling live quiz scoring, homework distribution, video streams pipelines, and text parsers.",
    skills: ["Ruby on Rails", "PostgreSQL", "Mux Video API", "WebRTC Peer Connections", "JSON Schemas"],
    year_completed: 2024,
    contract_value: "$950,000",
    client_type: "E-Learning Operator",
    certifications: ["FERPA Compliant", "WCAG 2.1 AA (Accessibility)"]
  },
  {
    id: "CAP-SWE-010",
    project_name: "Scalable Serverless Live Video Pipeline",
    description: "Built cloud services processing uploaded recordings into optimized HLS stream structures.",
    skills: ["AWS Lambda Functions", "FFmpeg Transcoding", "S3 Storage Hooks", "CloudFront CDN routing", "Redis Session Engine"],
    year_completed: 2026,
    contract_value: "$3,150,050",
    client_type: "Media Streaming Brand",
    certifications: ["ISO 27018 Cloud Privacy", "SOC 2 Type II"]
  }
];

// 2. BID HISTORY - 20 HISTORICAL BID ENTRIES
export const BID_HISTORY = [
  {
    bid_id: "BID-2026-001",
    title: "Sovereign Cloud Data Lake Infrastructure",
    sector: "IT Services",
    outcome: "win",
    match_score: 92,
    compliance_score: 95,
    budget_alignment: 85
  },
  {
    bid_id: "BID-2026-002",
    title: "State Transit High-Availability AD Restructure",
    sector: "IT Services",
    outcome: "win",
    match_score: 88,
    compliance_score: 90,
    budget_alignment: 95
  },
  {
    bid_id: "BID-2026-003",
    title: "Federal Defense HPC Slurm Redone SOW",
    sector: "IT Services",
    outcome: "loss",
    match_score: 74,
    compliance_score: 100,
    budget_alignment: 45
  },
  {
    bid_id: "BID-2025-004",
    title: "Municipal Water Treatment Piping Refract",
    sector: "Construction",
    outcome: "win",
    match_score: 85,
    compliance_score: 92,
    budget_alignment: 88
  },
  {
    bid_id: "BID-2025-005",
    title: "EcoSmart Green Office Complex Core",
    sector: "Construction",
    outcome: "win",
    match_score: 96,
    compliance_score: 95,
    budget_alignment: 75
  },
  {
    bid_id: "BID-2025-006",
    title: "Aviation Maintenance Hangar Seismic Reinforce",
    sector: "Construction",
    outcome: "loss",
    match_score: 65,
    compliance_score: 70,
    budget_alignment: 90
  },
  {
    bid_id: "BID-2026-007",
    title: "Global Supply Chain RFID Deployment",
    sector: "Logistics",
    outcome: "win",
    match_score: 90,
    compliance_score: 95,
    budget_alignment: 80
  },
  {
    bid_id: "BID-2026-008",
    title: "Temperature-Safe Pharma Dispatch Network",
    sector: "Logistics",
    outcome: "win",
    match_score: 86,
    compliance_score: 88,
    budget_alignment: 90
  },
  {
    bid_id: "BID-2025-009",
    title: "Cross-Border automated Customs OCR Platform",
    sector: "Logistics",
    outcome: "loss",
    match_score: 70,
    compliance_score: 65,
    budget_alignment: 95
  },
  {
    bid_id: "BID-2025-010",
    title: "National Grid Power Transition Analysis",
    sector: "Consulting",
    outcome: "win",
    match_score: 95,
    compliance_score: 100,
    budget_alignment: 90
  },
  {
    bid_id: "BID-2025-011",
    title: "Post-Merger ERP Consolidation Audit",
    sector: "Consulting",
    outcome: "win",
    match_score: 82,
    compliance_score: 85,
    budget_alignment: 95
  },
  {
    bid_id: "BID-2026-012",
    title: "SAFe Agile Product Transition Coaching",
    sector: "Consulting",
    outcome: "loss",
    match_score: 78,
    compliance_score: 80,
    budget_alignment: 55
  },
  {
    bid_id: "BID-2026-013",
    title: "Secure FinTech Mobile Banking Wallet",
    sector: "Software Development",
    outcome: "win",
    match_score: 94,
    compliance_score: 98,
    budget_alignment: 85
  },
  {
    bid_id: "BID-2026-014",
    title: "Real-time Kafka Checkout Refactor",
    sector: "Software Development",
    outcome: "win",
    match_score: 89,
    compliance_score: 95,
    budget_alignment: 90
  },
  {
    bid_id: "BID-2025-015",
    title: "Multi-Tenant LMS FERPA Compliant App",
    sector: "Software Development",
    outcome: "loss",
    match_score: 72,
    compliance_score: 85,
    budget_alignment: 60
  },
  {
    bid_id: "BID-2025-016",
    title: "Defense Cybersecurity Zero Trust Redone",
    sector: "IT Services",
    outcome: "win",
    match_score: 91,
    compliance_score: 95,
    budget_alignment: 85
  },
  {
    bid_id: "BID-2026-017",
    title: "Prefabricated Negative-Pressure Clinics",
    sector: "Construction",
    outcome: "win",
    match_score: 87,
    compliance_score: 90,
    budget_alignment: 95
  },
  {
    bid_id: "BID-2026-018",
    title: "Armored High-Value Micro-Transit Networks",
    sector: "Logistics",
    outcome: "win",
    match_score: 93,
    compliance_score: 95,
    budget_alignment: 85
  },
  {
    bid_id: "BID-2025-019",
    title: "ESG Scope 3 Disclosure Platform Build",
    sector: "Consulting",
    outcome: "win",
    match_score: 80,
    compliance_score: 85,
    budget_alignment: 90
  },
  {
    bid_id: "BID-2026-020",
    title: "AWS Serverless Dynamic Transcoding SOW",
    sector: "Software Development",
    outcome: "win",
    match_score: 95,
    compliance_score: 96,
    budget_alignment: 90
  }
];

// 3. EVALUATION CRITERIA TAXONOMY - 15 ENTRIES
export const EVALUATION_CRITERIA_TAXONOMY = [
  // IT Services
  {
    criteria_name: "SOC 2 Security Protocols Alignment",
    sector: "IT Services",
    weight_percentage: 35,
    description: "Evaluates standard SOC 2 Type II audit credentials, operational intrusion detection systems, firewalls, and active zero trust network access profiles."
  },
  {
    criteria_name: "High-Availability SLA Contingency",
    sector: "IT Services",
    weight_percentage: 30,
    description: "Assesses minimum horizontal auto-scaling capacities, live secondary disaster recoveries, and hot-standby redundancy limits supporting 99.9% uptime."
  },
  {
    criteria_name: "Cloud Integration Pricing Standard",
    sector: "IT Services",
    weight_percentage: 35,
    description: "Measures overall server migration licensing frameworks, data transfer pipelines costs, and initial enterprise setup volume discounts."
  },

  // Construction
  {
    criteria_name: "Structural Material Safety Certificates",
    sector: "Construction",
    weight_percentage: 40,
    description: "Evaluates PE structural engineering verifications, concrete stress tests, tensile cables, blast-walls, and NEMA safety alignments."
  },
  {
    criteria_name: "LEED Green Energy Compliance",
    sector: "Construction",
    weight_percentage: 30,
    description: "Assesses net-zero designs, rooftop solar generation capability, geothermal cooling integrations, and local recycled timber usages."
  },
  {
    criteria_name: "OSHA Site Safety Tracking History",
    sector: "Construction",
    weight_percentage: 30,
    description: "Checks on-site risk mitigation programs, contractor OSHA-30 credentials list, and past incident tracking statistics."
  },

  // Logistics
  {
    criteria_name: "RFID & Telematics Tracking Mesh",
    sector: "Logistics",
    weight_percentage: 35,
    description: "Evaluates IoT sensor deployments, geofencing alarms, continuous transit updates, and MQTT gateway integrations."
  },
  {
    criteria_name: "Cold-Chain Temperature Safeguards",
    sector: "Logistics",
    weight_percentage: 35,
    description: "Checks dual-cooling mechanical grid installations, alert lines, FDA GDP compliances, and automated container alarms."
  },
  {
    criteria_name: "EDI Commercial Invoice Pipelines",
    sector: "Logistics",
    weight_percentage: 30,
    description: "Measures automatic OCR invoice parsing tools, custom EDIFACT messaging triggers, and SAP ledger connectors."
  },

  // Consulting
  {
    criteria_name: "Carbon Accounting disclosure Level",
    sector: "Consulting",
    weight_percentage: 30,
    description: "Evaluates analytical scope 1-2-3 metrics, sustainability disclosures, GRI standard alignments, and SBTi guidelines compliance."
  },
  {
    criteria_name: "Enterprise M&A Due Diligence Auditing",
    sector: "Consulting",
    weight_percentage: 40,
    description: "Measures tech cost optimization frameworks, cash flow optimizations, financial consolidation audits, and risk ERM setups."
  },
  {
    criteria_name: "Prosci Agile Transition Leadership",
    sector: "Consulting",
    weight_percentage: 30,
    description: "Checks corporate workspace reorganizations, ADKAR change methodologies, and on-site scrum coaching milestones."
  },

  // Software Development
  {
    criteria_name: "OWASP Hardened Authentication Code",
    sector: "Software Development",
    weight_percentage: 40,
    description: "Checks biometric encryption models, credentials salted hashing algorithms, secure cookie setups, and OWASP ASVS verification tests."
  },
  {
    criteria_name: "Kafka Event Broker Throughput Capacity",
    sector: "Software Development",
    weight_percentage: 30,
    description: "Assesses concurrent sales payload management, Apache Flink streams scaling, message queue drops, and Golang backend structures."
  },
  {
    criteria_name: "HIPAA / FERPA Compliance Standards",
    sector: "Software Development",
    weight_percentage: 30,
    description: "Evaluates medical privacy rules, student databases controls encryption, and audited data masking mechanisms."
  }
];
