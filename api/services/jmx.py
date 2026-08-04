import xml.etree.ElementTree as ET

from config import config
from core.log import logger


def _build_argument(name, value):
    """Build a single JMeter Argument elementProp."""
    prop = ET.Element("elementProp", attrib={
        "name": name,
        "elementType": "Argument",
    })
    name_el = ET.SubElement(prop, "stringProp", attrib={"name": "Argument.name"})
    name_el.text = name
    val_el = ET.SubElement(prop, "stringProp", attrib={"name": "Argument.value"})
    val_el.text = value
    return prop


def validate_jmx(jmx_content: str | bytes) -> None:
    if not jmx_content:
        raise ValueError("JMX plan is empty")
    try:
        root = ET.fromstring(jmx_content)
    except ET.ParseError as e:
        raise ValueError(f"JMX plan is not valid XML: {e}") from e
    if root.tag != "jmeterTestPlan":
        raise ValueError("JMX plan must have a jmeterTestPlan root element")


def resolve_csv_parameter_files(jmx_content: str, job_id: str, filenames: list[str]) -> str:
    """Point CSV Data Set Config entries at uploaded files with matching basenames."""
    if not filenames:
        return jmx_content

    try:
        root = ET.fromstring(jmx_content)
    except ET.ParseError as e:
        raise ValueError(f"JMX plan is not valid XML: {e}") from e

    uploaded = set(filenames)
    matched_files: set[str] = set()
    replacements = 0
    for data_set in root.iter("CSVDataSet"):
        filename_prop = data_set.find("./stringProp[@name='filename']")
        if filename_prop is None or not filename_prop.text:
            continue
        basename = filename_prop.text.replace("\\", "/").rsplit("/", 1)[-1]
        if basename in uploaded:
            filename_prop.text = f"/data/{job_id}/{basename}"
            matched_files.add(basename)
            replacements += 1

    unreferenced_files = uploaded - matched_files
    if unreferenced_files:
        logger.warning(
            f"Job {job_id}: uploaded CSV files not referenced by a CSV Data Set Config: "
            f"{', '.join(sorted(unreferenced_files))}"
        )

    if not replacements:
        return jmx_content

    logger.info(f"Job {job_id}: resolved {replacements} CSV parameter file reference(s)")
    return ET.tostring(root, encoding="unicode", xml_declaration=True)


def inject_backend_listener(jmx_content: str, job_id: str) -> str:
    """
    Parse a JMX test plan and inject an InfluxDB BackendListener element
    so JMeter sends real-time metrics during execution.

    JMeter pods run with TZ=UTC so Influx line-protocol timestamps are UTC instants.

    If the plan already contains a BackendListener, the original content
    is returned unchanged to respect user configuration.
    """
    try:
        root = ET.fromstring(jmx_content)
    except ET.ParseError as e:
        logger.warning(f"Failed to parse JMX for backend listener injection: {e}")
        return jmx_content

    if root.find(".//BackendListener") is not None:
        logger.info(f"Job {job_id}: JMX already contains a BackendListener, skipping injection")
        return jmx_content

    # JMX structure: <jmeterTestPlan> -> <hashTree> -> <TestPlan> -> <hashTree>
    # The second hashTree is where ThreadGroups and other top-level elements live
    outer_hash = root.find("hashTree")
    if outer_hash is None:
        logger.warning(f"Job {job_id}: JMX has no outer hashTree, skipping injection")
        return jmx_content

    test_plan_hash = outer_hash.find("hashTree")
    if test_plan_hash is None:
        logger.warning(f"Job {job_id}: JMX has no test plan hashTree, skipping injection")
        return jmx_content

    influxdb_url = f"{config.INFLUXDB_URL}/write?db={config.INFLUXDB_DATABASE}"

    arguments = {
        "influxdbMetricsSender": "org.apache.jmeter.visualizers.backend.influxdb.HttpMetricsSender",
        "influxdbUrl": influxdb_url,
        "application": f"kb-{job_id}",
        "measurement": "jmeter",
        "summaryOnly": "false",
        "samplersRegex": ".*",
        "percentiles": "90;95;99",
        "testTitle": job_id,
        "eventTags": "",
    }

    backend = ET.SubElement(test_plan_hash, "BackendListener", attrib={
        "guiclass": "BackendListenerGui",
        "testclass": "BackendListener",
        "testname": "KubeblastMetrics",
        "enabled": "true",
    })

    args_prop = ET.SubElement(backend, "elementProp", attrib={
        "name": "arguments",
        "elementType": "Arguments",
        "guiclass": "ArgumentsPanel",
        "testclass": "Arguments",
    })
    collection = ET.SubElement(args_prop, "collectionProp", attrib={
        "name": "Arguments.arguments",
    })

    for arg_name, arg_value in arguments.items():
        collection.append(_build_argument(arg_name, arg_value))

    classname = ET.SubElement(backend, "stringProp", attrib={"name": "classname"})
    classname.text = "org.apache.jmeter.visualizers.backend.influxdb.InfluxdbBackendListenerClient"

    ET.SubElement(test_plan_hash, "hashTree")

    logger.info(f"Job {job_id}: Injected InfluxDB BackendListener (url={influxdb_url})")

    return ET.tostring(root, encoding="unicode", xml_declaration=True)
