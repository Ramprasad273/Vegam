import { VegamScenarioConfig } from '@vegam/engine';

/**
 * HDFS Distributed Syslog Template — NeuroLambda Stage 4 Scenario A
 *
 * Simulates the HDFS block lifecycle across NameNode and DataNode services.
 * Generates log text in the exact HDFS syslog format the Stage 1 BPE tokenizer
 * was trained on, ensuring LogBlockParser regex masks (<DATE>, <TIME>, <IP>, <HEX>)
 * fire correctly for in-distribution MambaLog inference.
 *
 * Anomaly rate: ~4% (matches real HDFS production base rate).
 * Ground-truth labels are attached via _vegam.is_anomaly and surprisalBits on
 * every emitted packet.
 *
 * FSM:
 *   [NameNode Alloc] --96%--> [DataNode Write] --> [NameNode ACK] (nominal)
 *                    --4%---> [PacketResponder Exception] --> [Dead DataNode Cascade] (fault)
 */
export const HdfsDistributedSyslogTemplate: VegamScenarioConfig = {
  scenarioId: 'hdfs-distributed-syslog-v1',
  scenarioName: 'HDFS Distributed Syslog — Block Lifecycle & Fault Cascade',
  description:
    'Simulates the HDFS block write lifecycle: NameNode allocation, DataNode packet transmission, and NameNode ACK (nominal path). Fault path injects PacketResponder exceptions and dead DataNode cascades at a 4% base rate, producing high-surprisal anomalous events for MambaLog evaluation.',
  version: '1.0.0',
  concurrency: 4,
  anomalyThresholdBits: 5.5,
  chaos: {
    enabled: true,
    mode: 'dlq_route',
    probability: 0.01,
    dlqTopicOrUri: 'hdfs.faults.dlq'
  },
  nodes: [
    // ─── Node 1: NameNode Block Allocation (Nominal Entry) ─────────────────
    {
      nodeId: 'node-namenode-alloc',
      nodeName: 'NameNode Block Allocator',
      nodeType: 'markov_fork',
      protocol: 'KAFKA',
      targetTopicOrUri: 'hdfs.namenode.alloc',
      emissionRateHz: 120,
      markovBranches: [
        { targetNodeId: 'node-datanode-write', probability: 0.96 },
        { targetNodeId: 'node-packet-exception', probability: 0.04 }
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

    // ─── Node 2: DataNode Packet Transmission (Nominal) ────────────────────
    {
      nodeId: 'node-datanode-write',
      nodeName: 'DataNode PacketResponder — Write',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'hdfs.datanode.write',
      emissionRateHz: 120,
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

    // ─── Node 3: NameNode Add Stored Block ACK (Nominal) ───────────────────
    {
      nodeId: 'node-namenode-ack',
      nodeName: 'NameNode addStoredBlock ACK',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'hdfs.namenode.ack',
      emissionRateHz: 120,
      synthesisRules: [
        { fieldName: 'blockId', ruleExpression: '$PREV.blockId' },
        { fieldName: 'datanodeIp', ruleExpression: '$PREV.datanodeIp' },
        { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
        {
          fieldName: 'log_line',
          ruleExpression:
            '"081109 203520 INFO dfs.FSNamesystem: BLOCK* NameSystem.addStoredBlock: blockMap updated: " + $PREV.datanodeIp + ":50010 is added to " + $PREV.blockId + " size " + faker.number.int({min:65536,max:134217728})'
        }
      ],
      surprisalRules: [
        {
          fieldName: 'log_line',
          type: 'categorical',
          categoricalWeights: { addStoredBlock: 0.97 },
          weight: 0.5
        }
      ]
    },

    // ─── Node 4: PacketResponder Exception (FAULT — High Surprisal) ────────
    {
      nodeId: 'node-packet-exception',
      nodeName: 'DataNode PacketResponder Exception',
      nodeType: 'dlq_route',
      protocol: 'KAFKA',
      targetTopicOrUri: 'hdfs.faults.packet_exception',
      emissionRateHz: 8,
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

    // ─── Node 5: Dead DataNode Cascade (FAULT — Highest Surprisal) ─────────
    {
      nodeId: 'node-dead-datanode',
      nodeName: 'DataNode Dead — Replication Cascade',
      nodeType: 'dlq_route',
      protocol: 'KAFKA',
      targetTopicOrUri: 'hdfs.faults.dead_datanode',
      emissionRateHz: 4,
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
        },
        {
          fieldName: 'log_line',
          type: 'categorical',
          categoricalWeights: { DatanodeDeadException: 0.005 },
          weight: 4.0
        }
      ]
    }
  ]
};
