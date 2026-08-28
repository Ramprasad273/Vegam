# Vegam — Terms of Use and Liability Disclaimer

Last Updated: July 12, 2026

By downloading, installing, copying, running, accessing, or otherwise using any part of the Vegam software, source code, command-line interface, studio web workbench, or related documentation (collectively, the "Software"), you ("User" or "Licensee") expressly accept and agree to be bound by the terms and conditions set forth in this document ("Terms of Use").

If you do not agree to all of these terms, do not install, access, or use the Software.


## 1. Disclaimer of Warranty

THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

IN NO EVENT SHALL THE AUTHORS, CREATORS, MAINTAINERS, CONTRIBUTORS, PROJECT FOUNDERS, OR COPYRIGHT HOLDERS OF VEGAM BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


## 2. Comprehensive Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE VEGAM PROJECT FOUNDERS, CREATORS, MAINTAINERS, CONTRIBUTORS, OR AFFILIATES BE LIABLE TO ANY USER OR THIRD PARTY FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES WHATSOEVER, INCLUDING BUT NOT LIMITED TO:

1. **System Disruption and Downtime**: Any interruption, degradation, slowdown, or crash of servers, networks, message brokers, streaming platforms, databases, or cloud infrastructure resulting from generated event traffic, synthetic telemetry, or load simulation.
2. **Data Loss or Corruption**: Loss, corruption, overwrite, or alteration of production or staging data, event streams, or database records caused by the transmission of synthetic packets, Dead Letter Queue routing, or chaos simulation.
3. **Financial Losses and Infrastructure Costs**: Costs incurred from cloud service providers (e.g., AWS, GCP, Azure, Confluent Cloud) due to high-throughput message generation, egress bandwidth fees, compute spike billing, or quota overruns.
4. **Security and Regulatory Compliance Failures**: Any security breaches, compliance violations, or regulatory fines resulting from the use, misconfiguration, or deployment of the Software in any environment.
5. **Loss of Profits or Business Opportunity**: Loss of revenue, business interruption, loss of goodwill, or anticipated savings arising from the deployment or inability to use the Software.

THIS LIMITATION OF LIABILITY APPLIES WHETHER THE CLAIM IS BASED ON CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, STATUTORY LIABILITY, OR ANY OTHER LEGAL THEORY, EVEN IF THE MAINTAINERS OR FOUNDERS HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.


## 3. Acceptable Use Policy and User Responsibility

Vegam is a powerful event simulation and testing platform engineered strictly for **authorized testing, benchmarking, and quality assurance** of software systems owned by or explicitly licensed to the User.

By using the Software, the User strictly covenants and agrees that:

1. **Explicit Authorization Required**: You will only connect Vegam to message brokers, APIs, webhook endpoints, and network targets (`Kafka`, `Redpanda`, `RabbitMQ`, `NATS`, `MQTT`, `HTTP`) where you have explicit, documented legal authorization from the infrastructure owner to conduct simulation and load testing.
2. **Prohibition of Unauthorized Network Scanning and Attacks**: You will not use the Software to conduct Distributed Denial of Service (DDoS) attacks, flood unauthorized third-party networks, stress test external public APIs without written permission, or attempt to overwhelm or disrupt any third-party services.
3. **Prohibition of Malicious Payloads**: You will not utilize the Software to synthesize, inject, or propagate malicious code, viruses, worms, ransomware, or exploits into any computer system or network.
4. **Environment Isolation**: You are solely and exclusively responsible for verifying the destination broker endpoints, connection profiles, and credentials entered into the Bring Your Own Broker Connection Vault or Command-Line Interface. The maintainers assume zero responsibility for traffic accidentally dispatched to production environments due to misconfiguration.

Any violation of this Acceptable Use Policy immediately revokes all rights granted to use the Software under these terms.


## 4. Indemnification

You agree to defend, indemnify, and hold harmless the Vegam project founders, creators, maintainers, contributors, and copyright holders from and against any and all claims, demands, suits, proceedings, losses, liabilities, damages, costs, and expenses (including reasonable legal fees and attorneys' fees) brought by any third party arising out of or related to:

1. Your use, misuse, operation, or deployment of the Software.
2. Your connection of the Software to any network, server, message broker, or external service.
3. Any violation by you of these Terms of Use, the Acceptable Use Policy, or applicable local, national, or international laws and regulations.


## 5. Compliance with Laws

You are strictly responsible for ensuring that your use of the Software complies with all applicable regional, national, and international laws, treaties, and regulations, including data privacy regulations (e.g., GDPR, CCPA, HIPAA) and cybersecurity laws. You must not generate synthetic personally identifiable information (PII) or protected health information (PHI) that violates legal or regulatory standards in your jurisdiction.


## 6. Open Source License Relationship

Vegam is distributed under the Apache License, Version 2.0. In the event of any conflict or inconsistency between these Terms of Use and the express provisions of the Apache License 2.0 regarding warranty disclaimers or liability limitations, the terms that provide the maximum protection and legal disclaimer of liability to the project founders and maintainers shall prevail and govern.


## 7. Governing Law

These Terms of Use shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law principles. Any legal action or proceeding arising out of or related to these Terms shall be brought exclusively in the state or federal courts located in Delaware.

## 8. Contact for Legal and Policy Inquiries

If you have questions regarding this policy, acceptable use guidelines, or licensing terms, please open an issue or security inquiry on the official GitHub repository tracker.
