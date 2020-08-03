import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { AngularFirestore } from '@angular/fire/firestore';
import { ConfigurationService } from './configuration.service';
import { Configuration, Player } from './model';

import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root',
})
export class NotificationsService {

    constructor(private afs: AngularFirestore, private configurationService: ConfigurationService, private swPush: SwPush) {
    }

    requestSubscription() {
        if (!this.swPush.isEnabled) {
            console.log("push notifications disabled");
            return;
        }
        this.configurationService.initialize().then(config => {
            if (config.pid) {
                this.afs.collection<Player>('players', ref => {
                    return ref.where('pid', '==', config.pid)
                })
                    .valueChanges()
                    .subscribe(players => {
                        if (players != null && players.length > 0) {
                            const player = players[0];
                            this.swPush.requestSubscription({
                                serverPublicKey: environment.vapidPublicKey
                            })
                                .then(sub => {
                                    const jsonSub = JSON.stringify(sub);
                                    if (!player.hasOwnProperty('pushSubscription') || player.pushSubscription != jsonSub) {
                                        player.pushSubscription = jsonSub;
                                        this.afs.collection<Player>('players').doc(player.uid).update(player);
                                    }
                                })
                                .catch(err => console.error("Could not subscribe to notifications", err));
                        }
                    });
            }
        });
    }
}