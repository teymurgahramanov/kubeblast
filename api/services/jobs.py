from api.core import db, models
import bson

def get_jobs(current_user):
    if current_user.role in ["admin", "moderator"]:
        jobs = list(db.mongo.jobs.find({}))
    else:
        jobs = list(db.mongo.jobs.find({"user": current_user.username}))
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
    
def create_job(job_data, file_name, current_user):
    job_data_dict = job_data.dict()

    job_data_dict["user"] = current_user.username
    job_data_dict["file_name"] = file_name

    try:
        models.Job(**job_data_dict)
    except Exception as e:
        return {"error": "Invalid job data"}
    
    try:
        db.mongo.jobs.insert_one(job_data_dict)
    except Exception as e:
        return False
    else:
        return True
    
def update_job(job_id, job_data):
    job = get_job(job_id)
    if not job:
        return None
    job_data = {key: value for key, value in job_data.items() if value not in [None, "", [], {}, ()]}
    try:
        db.mongo.jobs.update_one({"_id": bson.objectid.ObjectId(job_id)}, {"$set": job_data})
    except Exception as e:
        return False
    else:
        updated_job = get_job(job_id)
        return updated_job

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