import {  MeshBuilder, Matrix, PointerEventTypes,  Mesh,Animation, SceneLoader, Scene, Vector3, ArcRotateCamera, HemisphericLight} from '@babylonjs/core'
import {SkyMaterial} from "@babylonjs/materials/sky";
import "@babylonjs/loaders"
import { createPlayer, loadAvatarContainer } from '../creations.js'
import { getState, setState } from '../main.js'
import { emitMove, getAllPlayersInSocket, getMyDetail } from '../socket/socketLogic.js'

const log = console.log


let currentAnimation
let newAnimation
let interval


let players = []

// necessities to create player
let scene
let AvatarRoot
let animationsGLB = []

export function getScene(){
    return scene
}

export default async function createScene(_engine){
    scene = new Scene(_engine)
    const cam = new ArcRotateCamera('cam', -Math.PI/2, 1, 10, Vector3.Zero(), scene)
    cam.attachControl(document.querySelector('canvas'), true)
    // scene.createDefaultEnvironment()
    const light = new HemisphericLight('light', new Vector3(0,10,0), scene)

    const box = MeshBuilder.CreateBox("toInstanceBox", { height: 2}, scene)
    // Set the pivot matrix
    
    box.position = new Vector3(2,1,0)
    box.setPivotPoint(new Vector3(0,-1,0));
    log(box.getAbsolutePosition())
    const ground = MeshBuilder.CreateGround("asd", {width:100, height:100}, scene)

    const skybox = MeshBuilder.CreateBox("skyBox", {size: 500}, scene);
    skybox.infiniteDistance = true;
 
    // Create SkyMaterial and apply it to the skybox
    const skyMaterial = new SkyMaterial("skyMaterial", scene);
    skyMaterial.backFaceCulling = false;
  
    skyMaterial.inclination = 0.1; // Sun position (0 is sunrise, 0.5 is noon, 1 is sunset)
    skyMaterial.turbidity = .5; // Lower turbidity for a clearer sky
    skyMaterial.luminance = .9; // Higher luminance for a brighter sky
    skyMaterial.rayleigh = 2; // Adjust the scattering of light

    skybox.material = skyMaterial;

    AvatarRoot = await loadAvatarContainer(scene, "avatar.glb", SceneLoader)

    await importAnimations("idle_anim.glb")
    await importAnimations("walk_anim.glb") //1
    // await importAnimations("jump_anim.glb")
    await importAnimations("jump_new.glb")
    await importAnimations("walkback_anim.glb")

    log(animationsGLB)
    await scene.whenReadyAsync()

    setState("GAME")
    checkPlayers()
    scene.onPointerObservable.add((e) => {
        if (e.type === PointerEventTypes.POINTERDOWN) {
            const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), scene.activeCamera);
            let pickInfo = scene.pickWithRay(ray);
            const clickedMeshName = pickInfo.pickedMesh.name.toLowerCase()
            const clickedPos = pickInfo.pickedMesh.getAbsolutePosition()
            const myDetail = getMyDetail()
            const myMesh = scene.getMeshByName(`player.${myDetail._id}`)
            if(!myMesh) return log('cannot find my mesh')
            const currentPos = myMesh.position
            log('will move')
            emitMove({
                _id: myDetail._id, 
                movementName: "clickedTarget",
                loc: {x: currentPos.x, y: currentPos.y,z: currentPos.z}, 
                direction: {x: clickedPos.x, y: currentPos.y, z: clickedPos.z} 
              })
        }
    });
    scene.registerBeforeRender(() => {
        const deltaT = _engine.getDeltaTime()
        players.forEach(pl => {
            if(pl._movingForward){
                log("moving forward")
                // pl.anims[1].play()
                animationBlending(pl.anims[0], 1, pl.anims[1],1, false, .001)
                // pl.mainBody.lookAt(new Vector3(pl.dir.x, pl.mainBody.position.y, pl.dir.z),0,0,0)
            }
                   
       
        })
    })
    return {scene}
}

function importAnimations(animationGLB, _scene) {

    return SceneLoader.ImportMeshAsync(null, "./models/" + animationGLB, null, _scene)
      .then((result) => {
        result.meshes.forEach(element => {
            if (element) element.dispose();  
        });
        animationsGLB.push(result.animationGroups[0]);
    });
}
function playIdle(_scene) {   

    var randomNumber = 0;
    var newAnimation = _scene.animationGroups[randomNumber];
    // logger.info("Random Animation: " + newAnimation.name);

    // Check if currentAnimation === newAnimation
    while (currentAnimation === newAnimation) {
        randomNumber = 1;
        newAnimation = _scene.animationGroups[randomNumber];
        logger.info("Rechecking Anim: " + newAnimation.name);
    }

    _scene.onBeforeRenderObservable.runCoroutineAsync(
        animationBlending(currentAnimation, 1.0, newAnimation, 1.0, false, 0.01)
    );
   
}
function* animationBlending(fromAnim, fromAnimSpeedRatio, toAnim, toAnimSpeedRatio, repeat, speed)
{
    let currentWeight = 1;
    let newWeight = 0;
    fromAnim.stop();
    toAnim.play(repeat);
    fromAnim.speedRatio = fromAnimSpeedRatio;
    toAnim.speedRatio = toAnimSpeedRatio;
    while(newWeight < 1)
    {
        newWeight += speed;
        currentWeight -= speed;
        toAnim.setWeightForAllAnimatables(newWeight);
        fromAnim.setWeightForAllAnimatables(currentWeight);
        yield;
    }
    currentAnimation = toAnim;
}
function blendAnim(toAnim, _anims, isLooping){
    let currentWeight = 1;
    let newWeight = 0;
    let fromAnimSpeedRatio = 1
    let toAnimSpeedRatio = 1

    _anims.forEach(anim => {
        anim.setWeightForAllAnimatables(0);
    })

    currentAnimation.stop();
    toAnim.play(isLooping);

    currentAnimation.speedRatio = 1;
    toAnim.speedRatio = 1;

    toAnim.setWeightForAllAnimatables(0);
    currentAnimation.setWeightForAllAnimatables(1);
    
    let prevInterval = interval;

    clearInterval(interval)
    interval = setInterval(() => {
        if(newWeight >= 1) {
            currentAnimation = toAnim
            return clearInterval(prevInterval)
        }
        log('transitioning')
        currentWeight -= .05
        newWeight += .05
        toAnim.setWeightForAllAnimatables(newWeight);
        currentAnimation.setWeightForAllAnimatables(currentWeight);
    }, 25)
}
export function blendAnimv2(pl,toAnim, _anims, isLooping, afterEndDetail){
    let currentWeight = 1
    let newWeight = 0
    let desiredAnimIsPlaying = false
    pl.anims.forEach(anim => {
        if(anim.isPlaying){
            if(anim.name === toAnim.name) return desiredAnimIsPlaying = true
        }
    })
    if(desiredAnimIsPlaying) return 
    let currentPlayingAnim = pl.anims.find(anim => anim.isPlaying)// idle anim
    if(!currentPlayingAnim) {
        currentPlayingAnim = pl.anims[0]
        if(afterEndDetail){
            currentPlayingAnim = afterEndDetail.lastAnimation
        }
    }
    currentPlayingAnim.setWeightForAllAnimatables(currentWeight)
    toAnim.setWeightForAllAnimatables(newWeight)
    
    currentPlayingAnim.stop()
    toAnim.play(isLooping)
    clearInterval(pl.weightInterval)
    pl.weightInterval = setInterval(() => {
        currentWeight-=.1
        newWeight+=.1
        currentPlayingAnim.setWeightForAllAnimatables(currentWeight)
        toAnim.setWeightForAllAnimatables(newWeight)
        // log(newWeight)
        if(newWeight >= 1) return clearInterval(pl.weightInterval)
    }, 50)
    toAnim.onAnimationEndObservable.addOnce(() => {
        if(afterEndDetail) afterEndDetail.run()
    })
}
export function rotateAnim(dirTarg, body, rotationAnimation, scene, spdRatio, cb){
    var diffX = dirTarg.x - body.position.x;
    var diffY = dirTarg.z - body.position.z;
    const angle = Math.atan2(diffX,diffY)

    // rotationAnimation.setKeys([
    //     { frame: 0, value: body.rotation.y },
    //     // { frame: 40, value:  angle/3},
    //     { frame: 30, value: angle}
    // ]);

    let angleDifference = angle - body.rotation.y;

    // Ensure the angle is within the range [-π, π]
    if (angleDifference > Math.PI) {
    angleDifference -= 2 * Math.PI;
    } else if (angleDifference < -Math.PI) {
    angleDifference += 2 * Math.PI;
    }
    const targetAngle = body.rotation.y + angleDifference
    // if(body.rotation.y === targetAngle) return
 
    // Set up the rotation animation with the normalized angle
    rotationAnimation.setKeys([
        { frame: 0, value: body.rotation.y },
        { frame: 30, value: targetAngle }
    ]);

    body.animations[0] = rotationAnimation
    // scene.stopAnimation(body)
    scene.beginAnimation(body, 0, 30, false,spdRatio ? spdRatio : 4, () => {
        if(cb) cb()
    });
}

export function checkPlayers(){
    const state = getState()
    if(state !== "GAME") return log('Game is still not ready')
    const totalPlayers = getAllPlayersInSocket()
    if(totalPlayers.length){
        totalPlayers.forEach(pl => {
            const playerInScene = players.some(plscene => plscene._id === pl._id)
            if(playerInScene) return log('player is already in scene')

            players.push(createPlayer(pl, AvatarRoot, animationsGLB, scene))
        })
    }
}
export function getPlayersInScene(){
    return players
}
export function playerDispose(playerDetail){
    log(playerDetail)
    const playerToDispose = players.find(pl => pl._id === playerDetail._id)
    if(playerToDispose){
        log(playerToDispose)
        playerToDispose.anims.forEach(anim => anim.dispose())
        playerToDispose.mainBody?.getChildren()[0].dispose()
        
        players = players.filter(pl => pl._id !== playerToDispose._id)
    }
}
    // model.animationGroups = scene.animationGroups
    // animationsGLB = []
    
    // // scene.animationGroups[0]?.play(true);
    // currentAnimation = model.animationGroups[0]
    // currentAnimation.play(true)

    // newAnimation = model.animationGroups[1]
    // window.addEventListener("keydown", e => {
    //     if(e.key === "w") {
    //         log("PRESSED")
    //         blendAnim(newAnimation, model.animationGroups, true)            
    //     }
    //     if(e.key === "s") {
    //         log("PRESSED")
    //         blendAnim(model.animationGroups[3], model.animationGroups, true)
    //     }
    //     if(e.key === "a"){
    //         log('a is pressed')
    //         if(isMoving) return
    //         const dirTarg = {x: 5 ,y:player.rotation.y, z:0 }
    //         rotateAnim(dirTarg, body, rotationAnimation, scene, 2, () => {
    //             if(!isMoving) blendAnim(newAnimation, model.animationGroups, true) 
    //             isMoving = true
    //         })
    //     }
    //     if(e.key === "d"){
    //         log('a is pressed')
    //         if(isMoving) return
    //         const dirTarg = {x: -5 ,y:player.rotation.y, z:0 }
    //         rotateAnim(dirTarg, body, rotationAnimation, scene, 2, () => {
    //             if(!isMoving) blendAnim(newAnimation, model.animationGroups, true) 
    //             isMoving = true
    //         })
    //     }

    // })
    // window.addEventListener("keyup", e => {
    //     if(e.key === "a"){
    //         blendAnim(model.animationGroups[0], model.animationGroups, true)
    //         isMoving = false
    //     }
        
    //     if(e.key === "d"){
    //         blendAnim(model.animationGroups[0], model.animationGroups, true)
    //         isMoving = false
    //     }
    // })
    // const cyl = MeshBuilder.CreateCylinder('asd', { diameter: .5}, scene)
    // cyl.position = new Vector3(-3,0,0)

    // function blendAnim(toAnim, _anims, isLooping){
    //     let currentWeight = 1;
    //     let newWeight = 0;
    //     let fromAnimSpeedRatio = 1
    //     let toAnimSpeedRatio = 1
    
    //     _anims.forEach(anim => {
    //         anim.setWeightForAllAnimatables(0);
    //     })
    
    //     currentAnimation.stop();
    //     toAnim.play(isLooping);
    
    //     currentAnimation.speedRatio = 1;
    //     toAnim.speedRatio = 1;
    
    //     toAnim.setWeightForAllAnimatables(0);
    //     currentAnimation.setWeightForAllAnimatables(1);
        
    //     let prevInterval = interval;
    
    //     clearInterval(interval)
    //     interval = setInterval(() => {
    //         if(newWeight >= 1) {
    //             currentAnimation = toAnim
    //             return clearInterval(prevInterval)
    //         }
    //         log('transitioning')
    //         currentWeight -= .05
    //         newWeight += .05
    //         toAnim.setWeightForAllAnimatables(newWeight);
    //         currentAnimation.setWeightForAllAnimatables(currentWeight);
    //     }, 25)
    // }