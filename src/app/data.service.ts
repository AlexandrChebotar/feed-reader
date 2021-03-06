import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';
import { HttpService } from './http.service';
import { NzMessageService } from 'ng-zorro-antd';

export class Item {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  author: string;
  description: string;
  isRead: boolean;
  constructor(item: any) {
    item.isRead = false;
    return item;
  }
};
export class Feed {
  name: string;
  items: Item[] = [];
  activeItemGuid?: string;
  constructor(public url: string) {};
};
class Settings {
  showUnread = false;
  feedsVisible = true;
  newsVisible = true;
  statisticsVisible = true;
  chartVisible = true;
  managingFeeds = false;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private _settings: Settings = this._loadSettingsFromStorage() || new Settings;
  private _fetchingData = new BehaviorSubject<boolean>(false);
  fetchingData = this._fetchingData.asObservable();
  private _feeds = new BehaviorSubject<Feed[]>( this._loadFeedsFromStorage() ||
    [
      {url: 'https://nnmclub.to/forum/rssp.xml', name: 'NNM-Club', items: []},
      {url: 'https://pingvinus.ru/rss.xml', name: 'Пингвинус Linux', items: []},
    ]
  );
  feeds = this._feeds.asObservable();
  private _activeFeedUrl = new BehaviorSubject<string>(this._loadActiveFeedUrlFromStorage() || this._getActiveFeedUrl());
  activeFeedUrl = this._activeFeedUrl.asObservable();
  private _activeFeed = new BehaviorSubject<Feed>(this._getActiveFeed());
  activeFeed = this._activeFeed.asObservable();
  private _items = new BehaviorSubject<Item[]>(this._getItems());
  items = this._items.asObservable();
  private _activeItemGuid = new BehaviorSubject<string>(this._getActiveItemGuid());
  activeItemGuid = this._activeItemGuid.asObservable();
  private _activeItem = new BehaviorSubject<Item>(this._getactiveItem());
  activeItem = this._activeItem.asObservable();
  private _textDescription = new BehaviorSubject<string>(this._getTextDescription());
  textDescription = this._textDescription.asObservable();
  private _showUnread =new BehaviorSubject<boolean>(this._settings.showUnread);
  showUnread = this._showUnread.asObservable();
  private _feedsVisible =new BehaviorSubject<boolean>(this._settings.feedsVisible);
  feedsVisible = this._feedsVisible.asObservable();
  private _newsVisible =new BehaviorSubject<boolean>(this._settings.newsVisible);
  newsVisible = this._newsVisible.asObservable();
  private _statisticsVisible =new BehaviorSubject<boolean>(this._settings.statisticsVisible);
  statisticsVisible = this._statisticsVisible.asObservable();
  private _chartVisible =new BehaviorSubject<boolean>(this._settings.chartVisible);
  chartVisible = this._chartVisible.asObservable();
  private _managingFeeds =new BehaviorSubject<boolean>(this._settings.managingFeeds);
  managingFeeds = this._managingFeeds.asObservable();

  constructor(private _storage: StorageService, private _http: HttpService,private _message: NzMessageService) {};

  activateFeed(url: string): void {
    this._activeFeedUrl.next(url);
    this._activeFeed.next(this._getActiveFeed());
    this._items.next(this._getItems());
    this._activeItemGuid.next(this._getActiveItemGuid());
    this._activeItem.next(this._getactiveItem());
    this._textDescription.next(this._getTextDescription());
    this._saveToStorage();
  };
  activateItem(guid: string): void {
    const feed = this._getActiveFeed();
    feed.activeItemGuid = guid;
    this._activeFeed.next(feed);
    this._activeItemGuid.next(guid);
    this.read(guid);
    this._activeItem.next(this._getactiveItem());
    this._textDescription.next(this._getTextDescription());
    this._saveToStorage();
  };
  read(guid): void {
    this._getItem(guid).isRead=true;
    this._saveToStorage();
  };
  readAll(): void {
    this._getItems().map(item => item.isRead=true);
    this._saveToStorage();
  };
  toggleUnread(): void {
    this._showUnread.next(!this._showUnread.getValue());
    this._saveToStorage();
  }
  toggleFeeds(): void {
    this._feedsVisible.next(!this._feedsVisible.getValue());
    this._saveToStorage();
  }
  toggleNews(): void {
    this._newsVisible.next(!this._newsVisible.getValue());
    this._saveToStorage();
  }
  toggleStatistics(): void {
    this._statisticsVisible.next(!this._statisticsVisible.getValue());
    this._saveToStorage();
  }
  toggleChart(): void {
    this._chartVisible.next(!this._chartVisible.getValue());
    this._saveToStorage();
  }
  updateActiveFeed(): void {
    const activeFeedUrl = this._getActiveFeedUrl();
    this._updateFeed(activeFeedUrl);
  };
  updateAllFeeds(): void {
    this._fetchingData.next(true);
    this._getFeeds().forEach(feed => this._updateFeed(feed.url));
  }
  addNewFeed(newFeedURL: string): void {
    try {
      new URL(newFeedURL);
      const feeds = this._getFeeds();
      if (!feeds.find(feed => feed.url === newFeedURL)) {
        feeds.push(new Feed(newFeedURL));
        this.activateFeed(newFeedURL);
        this.updateActiveFeed();
        this._saveToStorage();
      } else {
        this._message.create('error', 'Same URL feed already exists');
      }
    } catch (error) {
      console.log(error);
        this._message.create('error', 'Invalid URL');
    }
  };
  deleteFeed(url: string): void {
    let feeds = this._getFeeds();
    feeds = feeds.filter(feed => !(feed.url === url));
    this._feeds.next(feeds);
    const activeFeedUrl = this._getActiveFeedUrl();
    if (url === activeFeedUrl) {
      const feeds = this._getFeeds();
      const firstFeedUrl = feeds[0] && feeds[0].url;
      this.activateFeed(firstFeedUrl);
    }
    this._saveToStorage();
  };
  renameFeed(url: string, name: string): void {
    const feeds = this._getFeeds();
    const feed = feeds.find(feed => feed.url === url);
    feed.name = name;
    this._feeds.next(feeds);
    this._saveToStorage();
  };
  manageFeeds(): void {
    this._managingFeeds.next(!this._managingFeeds.getValue());
    this._saveToStorage();
  }

  _getFeeds(): Feed[] {
    const feeds = this._feeds.getValue() || [];
    return feeds;
  };
  _getActiveFeedUrl(): string {
    let activeFeedUrl = this._activeFeedUrl && this._activeFeedUrl.getValue();
    if (!activeFeedUrl) {
      const feeds = this._getFeeds();
      activeFeedUrl = feeds && feeds[0] && feeds[0].url;
    }
    return activeFeedUrl;
  }
  _getActiveFeed(): Feed {
    const feeds = this._getFeeds();
    const activeFeedUrl = this._activeFeedUrl.getValue();
    const activeFeed = activeFeedUrl && feeds.find(feed => feed.url === activeFeedUrl) || feeds[0];
    return activeFeed;
  };
  _getItems(): Item[] {
    const activeFeed = this._getActiveFeed();
    const items = activeFeed && activeFeed.items;
    return items;
  };
  _getActiveItemGuid(): string {
    const activeFeed = this._getActiveFeed();
    const activeItemGuid = activeFeed && (activeFeed.activeItemGuid || (activeFeed.items[0] && activeFeed.items[0].guid));
    return activeItemGuid;
  };
  _getItem(guid: string): Item {
    const items = this._getItems();
    const item = items && items.find(item => item.guid === guid);
    return item;
  };
  _getactiveItem(): Item {
    const items = this._getItems();
    const activeItem = items && items.find(item => item.guid === this._activeItemGuid.getValue());
    return activeItem;
  };
  _getTextDescription(): string {
    const activeItem = this._getactiveItem();
    const description = activeItem && activeItem.description;
    const el = document.createElement('div');
    el.innerHTML = description;
    const textDescription = description && el.innerText;
    return textDescription;
  };
  _saveToStorage(): void {
    this._storage.set('data', {feeds: this._getFeeds(), activeFeedUrl: this._getActiveFeedUrl()});
    this._storage.set('settings', {
      showUnread: this._showUnread.getValue(),
      feedsVisible: this._feedsVisible.getValue(),
      newsVisible: this._newsVisible.getValue(),
      statisticsVisible: this._statisticsVisible.getValue(),
      chartVisible: this._chartVisible.getValue(),
      managingFeeds: this._managingFeeds.getValue(),
    });
  };
  _loadDataFromStorage(): any {
    return this._storage.get('data');
  }
  _loadSettingsFromStorage(): any {
    return this._storage.get('settings');
  }
  _loadFeedsFromStorage(): Feed[] {
    const loaded = this._loadDataFromStorage();
    const feeds = loaded && loaded.feeds;
    return feeds;
  }
  _loadActiveFeedUrlFromStorage(): string {
    const loaded = this._loadDataFromStorage();
    const activeFeedUrl = loaded && loaded.activeFeedUrl;
    return activeFeedUrl;
  }
  _updateFeed(url: string): void {
    this._fetchingData.next(true);
    this._http.fetchFeed(url).subscribe(
      res => {
        const {feed: resFeed , items: resItems} = res;
        const {url: resUrl, title: resName} = resFeed;
        const feeds = this._getFeeds();
        const feed = feeds.find(feed => feed.url === resUrl);
        let {url, name, items} = feed;
        let newItems: Item[] = resItems.map((item: any) => new Item(item));
        if (items) {
          newItems = newItems.filter(newItem => !items.some(item => item.guid === newItem.guid));
          feed.items = [...newItems, ...items];
        } else {
          feed.items = newItems;
        }
        feed.name = name || resName;
        this._feeds.next(feeds);
        this.activateFeed(url);
        this._fetchingData.next(false);
        this._message.create('success', `Update complete. Loaded ${newItems.length} news to ${feed.name} feed.`);
        this._saveToStorage();
      },
      err => {
        this._fetchingData.next(false);
        this._message.create('error', err);
      }
    );
  };
}
