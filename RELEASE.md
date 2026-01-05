# Kubeblast 1.2.0 🚀

## What's new?

### ⚡ Distributed Load Testing
Run JMeter in **true distributed mode** with an automatically provisioned **master/slave architecture**. Load tests now can run across multiple nodes, allowing Kubeblast to efficiently utilize Kubernetes clusters of any size.

### 🔐 API Automation with Personal Access Tokens
Integrate Kubeblast into your **CI/CD pipelines** or custom automation workflows.  
Personal Access Tokens (PATs) are managed directly from the **User Profile**, where you’ll also find a built-in link to the **in-app API documentation**.  
> Available only in **Advanced Edition**.

### 📊 Job Transparency
A brand-new **Job page** and detailed **job event timeline** give you complete visibility into what’s happening with your load tests—so you always know the exact state of job, directly from the UI.

### 🧹 Smarter Resource Management
Kubeblast now automatically cleans up workloads as soon as a job **completes or fails**, instantly freeing cluster resources. Combined with improved job status synchronization, Kubeblast becomes even more reliable.

## Upgrade notes

- **API prefix change**: routes are now served under **`/api/v1`**.