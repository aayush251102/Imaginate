import jwt from 'jsonwebtoken'


const userAuth = async (req,res,next) =>{
    const {token} = req.headers;

    if(!token){
        return res.json({sucess: false, message: 'Not Authorized. Login Again'});
    }

    // else..token is avail..find the id

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if(tokenDecode.id)
        {
            req.body = req.body || {};
            req.body.userId = tokenDecode.id;
        }
        else
        {
            return res.json({sucess: false, message: 'Not Authorized. Login Again'});
        }

        next();  // will execute the controller func that will execute the userCredit

    } catch (error) {
        res.json({sucess: false, message: error.message});
    }
}

export default userAuth