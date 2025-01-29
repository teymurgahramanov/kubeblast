from api.core import db
from bson import ObjectId

def get_jobs(current_user):
    if current_user.get("role") == "admin":
        jobs = list(db.mongo.jobs.find({}))
    else:
        jobs = list(db.mongo.jobs.find({"user": current_user["username"]}))
    for job in jobs:
        job["_id"] = str(job["_id"])
    return {"jobs": jobs}

def get_job(job_id):
    try:
        job = db.mongo.jobs.find_one({"_id": ObjectId(job_id)})
        if not job:
            return {"error": "Job not found"}
        job["_id"] = str(job["_id"])
        return job
    except:
        return {"error": "Invalid job ID"}
    
def create_job(job_data):
    job_data_dict = job_data.dict()
    try:
        db.mongo.jobs.insert_one(job_data_dict)
    except Exception as e:
        return False
    else:
        return True
    
def delete_job(job_name):
    job = get_job(job_name)
    if not job:
        return None
    try:
        db.mongo.jobs.delete_one({"name": job_name})
    except Exception as e:
        return False
    else:
        return True