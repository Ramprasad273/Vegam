import { VegamScenarioConfig } from '@vegam/engine';

/**
 * HDFS Distributed Syslog — Drift Variant (E3 Experiment)
 *
 * This template is used exclusively in Experiment E3 (Concept Drift Detection).
 * It represents a degraded HDFS cluster state: sustained DataNode failures raise
 * the anomaly rate from 4% (nominal) to 25% (incident).
 *
 * It is launched at block index 300 by killing the nominal subprocess and spawning
 * this one, creating a genuine input distribution shift detectable by Page-Hinkley.
 *
 * FSM: Same as nominal but Markov weights rebalanced to 75% nominal / 25% fault.
 */
export const HdfsDistributedSyslogDriftTemplate: VegamScenarioConfig = {
  scenarioId: 'hdfs-distributed-syslog-drift-v1',
  scenarioName: 'HDFS Distributed Syslog — Degraded Cluster Incident (Drift)',
  description:
    'Drift variant of hdfs-distributed-syslog-v1. Simulates a sustained cluster degradation incident with 25% anomaly rate (vs 4% nominal). Used in Experiment E3 to trigger the Page-Hinkley online drift detector.',
  version: '1.0.0',
  concurrency: 4,
  anomalyThresholdBits: 5.5,
  chaos: {
    enabled: true,
    mode: 'dlq_route',
    probability: 0.05,
    dlqTopicOrUri: 'hdfs.faults.dlq'
  },
  nodes: [
    {
      nodeId: 'node-namenode-alloc-drift',
      nodeName: 'NameNode Block Allocator (Degraded)',
      nodeType: 'markov_fork',
      protocol: 'KAFKA',
      targetTopicOrUri: 'hdfs.namenode.alloc',
      emissionRateHz: 120,
      markovBranches: [
        { targetNodeId: 'node-datanode-write-drift', probability: 0.75 },
        { targetNodeId: 'node-packet-exception-drift', probability: 0.25 }
      ],
      synthesisRules: [
        { fieldName: 'blockId', ruleExpression: '/^blk_-[0-9]{19}$/' },
        { fieldName: 'datanodeIp', ruleExpression: 'faker.internet.ip' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"081109 203518 INFO dfs.FSNamesystem: BLOCK* NameNode.allocateBlock: /user/root/data/part-" + faker.number.int({min:0,max:9999}) + ".dat._COPYING_ " + $PREV.blockId'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'log_line',
          type: 'categorical',
          categoricalWeights: { INFO: 0.96 },
          weight: 0.5
        }
      ]
    },
    {
      nodeId: 'node-datanode-write-drift',
      nodeName: 'DataNode PacketResponder — Write (Degraded)',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'hdfs.datanode.write',
      emissionRateHz: 90,
      synthesisRules: [
        { fieldName: 'blockId', ruleExpression: '$PREV.blockId' },
        { fieldName: 'datanodeIp', ruleExpression: '$PREV.datanodeIp' },
        { fieldName: 'bytesSent', ruleExpression: 'faker.number.int({min:65536,max:134217728})' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"081109 203519 INFO dfs.DataNode$PacketResponder: PacketResponder " + faker.number.int({min:0,max:2}) + " for block " + $PREV.blockId + " terminating"'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'bytesSent',
          type: 'gaussian',
          mu: 67108864,
          sigma: 20000000,
          weight: 1.0
        }
      ]
    },
    {
      nodeId: 'node-packet-exception-drift',
      nodeName: 'DataNode PacketResponder Exception (Incident Rate)',
      nodeType: 'dlq_route',
      protocol: 'KAFKA',
      targetTopicOrUri: 'hdfs.faults.packet_exception',
      emissionRateHz: 30,
      synthesisRules: [
        { fieldName: 'blockId', ruleExpression: '$PREV.blockId' },
        { fieldName: 'datanodeIp', ruleExpression: '$PREV.datanodeIp' },
        { fieldName: 'errorCode', ruleExpression: 'faker.helpers.weighted([{v:"java.io.IOException",w:0.55},{v:"java.net.SocketTimeoutException",w:0.30},{v:"org.apache.hadoop.hdfs.server.datanode.BlockRecoveryWorker$RecoveryTaskContiguous",w:0.15}])' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"081109 203521 ERROR dfs.DataNode$PacketResponder: Exception in receiveBlock for block " + $PREV.blockId'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'errorCode',
          type: 'categorical',
          categoricalWeights: {
            'java.io.IOException': 0.03,
            'java.net.SocketTimeoutException': 0.015,
            'org.apache.hadoop.hdfs.server.datanode.BlockRecoveryWorker$RecoveryTaskContiguous': 0.005
          },
          weight: 4.5
        }
      ]
    },
    {
      nodeId: 'node-dead-datanode-drift',
      nodeName: 'DataNode Dead — Mass Replication Failure (Incident)',
      nodeType: 'dlq_route',
      protocol: 'KAFKA',
      targetTopicOrUri: 'hdfs.faults.dead_datanode',
      emissionRateHz: 20,
      synthesisRules: [
        { fieldName: 'blockId', ruleExpression: '$PREV.blockId' },
        { fieldName: 'datanodeIp', ruleExpression: '$PREV.datanodeIp' },
        { fieldName: 'replicasLeft', ruleExpression: 'faker.number.int({min:0,max:1})' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"081109 203522 ERROR dfs.FSNamesystem: BLOCK* NameNode.addStoredBlock: Registering new datanode exception: DatanodeCommand action: DNA_INVALIDATE for block " + $PREV.blockId + " on dead DataNode " + $PREV.datanodeIp'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'replicasLeft',
          type: 'gaussian',
          mu: 3.0,
          sigma: 0.1,
          weight: 5.0
        }
      ]
    }
  ]
};
