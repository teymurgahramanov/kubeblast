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


def inject_backend_listener(jmx_content: str, job_id: str) -> str:
    """
    Parse a JMX test plan and inject an InfluxDB BackendListener element
    so JMeter sends real-time metrics during execution.

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
