import { Injectable } from '@angular/core';
import { Game, Player, Configuration } from './model';
import { AngularFirestore } from '@angular/fire/firestore';
import { ConfigurationService } from './configuration.service';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {

  public configuration: Configuration;
  
  constructor(private afs: AngularFirestore, private configurationService: ConfigurationService) {
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

  linkGameToUser(game: Game, playerType: string) {
    if (this.configuration.pid == null) {
      if (game[`${playerType}pkey`] == null) {
        this.createPlayer(game, playerType);
      } else {
        this.loadPlayerFromGame(game, playerType);
      }
    } else if (game[`${playerType}pkey`] == null) {
      this.setGamePlayer(game, playerType);
    } else {
      this.checkGamePlayer(game, playerType);
    }
  }

  private createPlayer(game: Game, playerType: string) {
    const player: Player = {
      uid: null,
      pid: this.uuidv4(),
      name: null,
      stars: []
    };
    this.afs.collection<Player>('players').add(player).then(result => {
      player.uid = result.id;
      this.afs.collection<Player>('players').doc(result.id).update(player).then(() => {
        // player created: update config
        this.configuration.pid = player.pid;
        this.configurationService.save();
        game[`${playerType}pkey`] = player.uid;
        this.afs.collection<Game>('games').doc(game.uid).update(game);
      });
    });
  }

  private loadPlayerFromGame(game: Game, playerType: string) {
    // read player
    this.afs.doc<Player>('players/' + game[`${playerType}pkey`])
      .valueChanges()
      .subscribe(player => {
        // update config
        this.configuration.pid = player.pid;
        this.configuration.name = player.name;
        this.configurationService.save();
      });
    // TO DO : when player not found
  }

  private setGamePlayer(game: Game, playerType: string) {
    // get player data
    this.afs.collection<Player>('players', ref => {
      return ref.where('pid', '==', this.configuration.pid)
    })
      .valueChanges()
      .subscribe(players => {
        if (players == null || players.length == 0) {
          // TO DO: when player not found
        } else {
          game[`${playerType}pkey`] = players[0].uid;
          this.afs.collection<Game>('games').doc(game.uid).update(game);
        }
      });
  }

  private checkGamePlayer(game: Game, playerType: string) {
    // get player data
    this.afs.collection<Player>('players', ref => {
      return ref.where('pid', '==', this.configuration.pid)
    })
      .valueChanges()
      .subscribe(players => {
        if (players == null || players.length == 0) {
          // TO DO: when player not found
        } else //if ((this.playerType == 'w' && this.game.wpkey != players[0].uid) || (this.playerType == 'b' && this.game.bpkey != players[0].uid)) {
          if (game[`${playerType}pkey`] != players[0].uid) {
            // resync player uid
            game[`${playerType}pkey`] = players[0].uid;
            this.afs.collection<Game>('games').doc(game.uid).update(game);
          }
      });
    // TO DO: when player not found
  }
  
}