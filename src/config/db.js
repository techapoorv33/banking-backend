const mongoose=require("mongoose")



function connecttoDB(){

    mongoose.connect(process.env.MONGO_URI)
        .then(()=>{
            console.log("Server connected to DB")
        })
        .catch(err=>{
            console.log("error connecting to DB")
            process.exit(1)
        })
}

module.exports=connecttoDB