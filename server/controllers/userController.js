import userModel from "../models/userModel.js";
import bcrypt from 'bcrypt'; // to decrypty the password
import jwt from 'jsonwebtoken'; // generate a token to authenticate the user. 
import razorpay from 'razorpay';
import transactionModel from "../models/transactionModel.js";

const registerUser = async(req,res) => {
    try {
        const {name,email,password} = req.body;

        if(!name || !email || !password){
            return res.json({success: false, message: 'Missing Details'})
        }
        // else
        const salt = await bcrypt.genSalt(10); // increase the value for more secure but will take time.
        const hashedPassword = await bcrypt.hash(password,salt);

        const userData= {name, email, password:hashedPassword};

        const newUser = new userModel(userData); // added a new user to mongodb
        const user = await newUser.save();

        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET); //using unique data ...generate token
        res.json({success: true, token, user: {name: user.name}});

        
    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message});
    }
}

const loginUser = async(req,res) => {
    try {
        const {email,password} = req.body;
        const user = await userModel.findOne({email});

        if(!user){
            return res.json({success: false, message: 'User does not exist'})
        }
        // if user is there
        const isMatch = await bcrypt.compare(password,user.password);
        if(isMatch){
             const token = jwt.sign({id: user._id}, process.env.JWT_SECRET);
             res.json({success: true, token, user: {name: user.name}});   
        }
        else{
            return res.json({success: false, message: 'Invalid credentials'})
        }

    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message});
    }
}

const userCredits = async(req,res) => {
    try {
        const {userId} = req.body
        
        const user = await userModel.findById(userId);
        res.json({success: true, credits: user.creditBalance, user: {name: user.name}});
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message});
    }
}

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const paymentRazorPay = async(req,res) => {
    try {
        
        const {userId, planId} = req.body;
        
        const userData = await userModel.findById(userId);

        if(!userId || !planId){
            return res.json({sucess: false, message: 'Missing details.'})
        }
        //else
        let credits, plan, amount, date;
        switch (planId) {
            case 'Basic':
                plan = 'Basic'
                credits = 100
                amount = 10
                break;
            case 'Advanced':
                plan = 'Advanced'
                credits = 500
                amount = 50
                break;
            case 'Business':
                plan = 'Business'
                credits = 5000
                amount = 250
                break;
            default:
                return res.json({success: false, message: 'Plan not found!'});
        }

        date = Date.now();
         
        const transactionData = {
            userId, plan, amount, credits, date
        }

        const newTransaction = await transactionModel.create(transactionData);

        const options = {
            amount: amount * 100,
            currency: process.env.CURRENCY,
            receipt: newTransaction._id //unique auto generated id by mongodb
        }

        await razorpayInstance.orders.create(options, (error, order) =>
        {
            if(error){
                console.log(error);
                return res.json({success: false, message: error})
            }
            // no error
            res.json({success: true, order})
        })

    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message});
    }
}


const verifyRazorPay = async(req,res)=>{
    try {
        
        const {razorpay_order_id} = req.body;
        const orderinfo = await razorpayInstance.orders.fetch(razorpay_order_id);

        if(orderinfo.status === 'paid'){
            const transactionData  = await transactionModel.findById(orderinfo.receipt);

            if(transactionData.payment){ // already verified
                return res.json({success: false, message: 'Payment Failed'}); // already paid
            }
            // if false
            const userData = await userModel.findById(transactionData.userId);
            const creditBalance = userData.creditBalance + transactionData.credits;
            await userModel.findByIdAndUpdate(userData._id, {creditBalance});

            await transactionModel.findByIdAndUpdate(transactionData._id, {payment: true})
            res.json({success: true, message: 'Credits Added.'})
        }
        else{
            res.json({success: false, message: 'Payment Failed'});
        }

    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message});
        
    }
}

export  {registerUser,loginUser, userCredits, paymentRazorPay, verifyRazorPay};