import { Injectable } from '@angular/core';
import { Game, Player, Configuration } from './model';
import { AngularFirestore } from '@angular/fire/firestore';
import { ConfigurationService } from './configuration.service';
import { NotificationsService } from './notifications.service';
import { throwError, Subject } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {

  public configuration: Configuration;

  constructor(
    private afs: AngularFirestore,
    private configurationService: ConfigurationService,
    private notificationsService: NotificationsService) {
    this.configurationService.initialize().then(config => {
      this.configuration = config;
    });
  }

  uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  linkGameToUser(game: Game, playerType: string, theSubject : Subject<boolean>) {
    if (this.configuration.pid == null) {
      if (game[`${playerType}pkey`] == null) {
        this.createPlayer(game, playerType, theSubject);
      } else {
        this.loadPlayerFromGame(game, playerType, theSubject);
      }
    } else if (game[`${playerType}pkey`] == null) {
      this.setGamePlayer(game, playerType, theSubject);
    } else {
      this.checkGamePlayer(game, playerType, theSubject);
    }
  }

  private createPlayer(game: Game, playerType: string, theSubject : Subject<boolean>) {
    const player: Player = {
      uid: null,
      pid: this.uuidv4(),
      name: null,
      stars: [],
      pushSubscription: null
    };
    this.afs.collection<Player>('players').add(player).then(result => {
      player.uid = result.id;
      this.afs.collection<Player>('players').doc(result.id).update(player).then(() => {
        // player created: update config
        this.configuration.pid = player.pid;
        this.configurationService.save();
        game[`${playerType}pkey`] = player.uid;
        this.afs.collection<Game>('games').doc(game.uid).update(game);
        this.notificationsService.requestSubscription();
        theSubject.next(true);
      });
    });
  }

  private loadPlayerFromGame(game: Game, playerType: string, theSubject : Subject<boolean>) {
    // read player
    this.afs.doc<Player>('players/' + game[`${playerType}pkey`])
      .valueChanges()
      .subscribe(player => {
        // update config
        this.configuration.pid = player.pid;
        this.configuration.name = player.name;
        this.configurationService.save().then(() => this.notificationsService.requestSubscription());
        theSubject.next(true);
      });
    // TO DO : when player not found
  }

  private setGamePlayer(game: Game, playerType: string, theSubject : Subject<boolean>) {
    // get player data
    return this.afs.collection<Player>('players', ref => {
      return ref.where('pid', '==', this.configuration.pid)
    })
      .valueChanges()
      .subscribe(players => {
        if (players == null || players.length == 0) {
          // TO DO: when player not found
          theSubject.next(false);
        } else {
          const opponent = (playerType == 'w' ? 'b' : 'w');
          if (game[`${opponent}pkey`] != players[0].uid) {
            game[`${playerType}pkey`] = players[0].uid;
            this.afs.collection<Game>('games').doc(game.uid).update(game);
            theSubject.next(true);
          } else {
            theSubject.next(false);
          }
        }
      });
  }

  private checkGamePlayer(game: Game, playerType: string, theSubject : Subject<boolean>) {
    // get player data
    return this.afs.collection<Player>('players', ref => {
      return ref.where('pid', '==', this.configuration.pid)
    })
      .valueChanges()
      .subscribe(players => {
        if (players == null || players.length == 0) {
          // TO DO: when player not found
          theSubject.next(false);
        } else if (game[`${playerType}pkey`] == players[0].uid) {
          theSubject.next(true);
        } else {
          const opponent = (playerType == 'w' ? 'b' : 'w');
          if (game[`${opponent}pkey`] != players[0].uid) {
            // resync player uid
            game[`${playerType}pkey`] = players[0].uid;
            this.afs.collection<Game>('games').doc(game.uid).update(game);
            theSubject.next(true);
          } else {
            theSubject.next(false);
          } 
        }
      });
  }

}